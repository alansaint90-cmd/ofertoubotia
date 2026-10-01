import { captureProduct } from "./capture.js";
const el = id => document.getElementById(id);
let captured;
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const settings = await chrome.storage.local.get("origin");
if (settings.origin) el("origin").value = settings.origin;
const key = `affiliate:${tab.id}`;
const saved = await chrome.storage.session.get(key);
el("affiliate").value = saved[key] || "";
function affiliate() {
  const u = new URL(el("affiliate").value.trim());
  if (u.protocol !== "https:" || u.username || u.password || u.port || !(u.hostname === "meli.la" || u.hostname === "mercadolivre.com.br" || u.hostname.endsWith(".mercadolivre.com.br"))) throw new Error("Informe o link de afiliado HTTPS original.");
  return u.href;
}
function origin() {
  const u = new URL(el("origin").value.trim());
  if (u.protocol !== "https:" || u.username || u.password || u.pathname !== "/" || u.search || u.hash) throw new Error("Informe somente o domínio HTTPS do seu Ofertou.");
  return u.origin;
}
async function run(fn) {
  el("status").textContent = "Processando…";
  try { await fn(); } catch (e) { el("status").textContent = e.message || "Falha na captura."; }
}
el("open").onclick = () => run(async () => {
  const link = affiliate();
  const opened = await chrome.tabs.create({ url: link });
  await chrome.storage.session.set({ [`affiliate:${opened.id}`]: link });
  el("status").textContent = "Na nova aba, abra a extensão novamente e clique em Capturar.";
});
el("capture").onclick = () => run(async () => {
  captured = undefined; el("preview").hidden = true;
  const link = affiliate();
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: captureProduct });
  if (!result?.result) throw new Error("Não foi possível ler o produto. Abra a página e tente novamente.");
  captured = { ...result.result, affiliateUrl: link };
  const photo = new URL(captured.imageUrl);
  if (photo.protocol !== "https:" || !photo.hostname.endsWith(".mlstatic.com")) throw new Error("Foto não reconhecida.");
  el("title").textContent = captured.title;
  el("image").src = captured.imageUrl;
  el("price").textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(captured.price);
  el("conditions").textContent = captured.description;
  el("preview").hidden = false;
  el("status").textContent = "Confira o produto. A próxima etapa abre a revisão no Ofertou.";
});
el("send").onclick = () => run(async () => {
  if (!captured || captured.affiliateUrl !== affiliate()) throw new Error("Capture novamente após alterar o link.");
  const destination = origin();
  await chrome.storage.local.set({ origin: destination });
  await chrome.tabs.create({ url: `${destination}/integrations#ofertou-import=${encodeURIComponent(JSON.stringify(captured))}` });
  el("status").textContent = "Prévia aberta. Libere o acesso à coleção e confirme no Ofertou.";
});
