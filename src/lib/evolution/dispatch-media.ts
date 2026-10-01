export function dispatchMediaPayload(number: string, body: string, snapshot: { source?: string; imageUrl?: string }) {
  if (snapshot?.source !== "collection") return { number, text: body };
  const image = new URL(snapshot.imageUrl ?? "");
  if (image.protocol !== "https:" || image.username || image.password || image.port || !image.hostname.endsWith(".mlstatic.com")) throw new Error("invalid_image");
  return { number, mediatype: "image", media: image.href, caption: body };
}
