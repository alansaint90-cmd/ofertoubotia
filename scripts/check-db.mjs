import pg from "pg";

const value = process.env.DATABASE_URL;
if (!value) {
  console.error("DATABASE_URL ausente no ambiente deste processo. Configure-a no serviço do app Ofertou.");
  process.exit(1);
}

let url;
try {
  url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.hostname || !url.pathname.slice(1)) {
    throw new Error("invalid URL");
  }
} catch {
  console.error("DATABASE_URL tem formato inválido. Use postgresql://usuario:senha@host:5432/banco (sem espaços ou colchetes).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 10000 });
try {
  await pool.query("select 1");
  console.log("PostgreSQL: conexão estabelecida.");
  const result = await pool.query("select to_regclass('public.users') is not null as users, to_regclass('public.dispatches') is not null as dispatches");
  const { users, dispatches } = result.rows[0];
  console.log(`Tabelas da aplicação: ${users && dispatches ? "presentes" : "incompletas; execute pnpm db:migrate"}.`);
} catch (error) {
  const reasons = {
    ENOTFOUND: "host não encontrado", EAI_AGAIN: "resolução do host indisponível",
    ECONNREFUSED: "conexão recusada", ETIMEDOUT: "tempo de conexão esgotado",
    "28P01": "usuário ou senha recusados", "3D000": "banco inexistente",
    "42501": "permissão negada", "28000": "autorização negada",
  };
  const reason = reasons[error?.code] ?? "falha de conexão ou consulta";
  console.error(`PostgreSQL: ${reason}. Código: ${typeof error?.code === "string" ? error.code : "indisponível"}. Confira DATABASE_URL e a rede interna do EasyPanel.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
