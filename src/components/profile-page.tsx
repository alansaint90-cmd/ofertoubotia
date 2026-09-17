"use client";

import { useState, type FormEvent } from "react";
import { CircleUserRound, Info, Save, ShieldCheck } from "lucide-react";
import { demoProfileSchema, type DemoProfile } from "@/lib/demo-profile";

export function ProfilePage({ profile, onSave }: { profile: DemoProfile; onSave: (profile: DemoProfile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState("");
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = demoProfileSchema.safeParse({ ...draft, email: draft.email.trim().toLowerCase() });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Confira os dados informados.");
      return;
    }
    setError("");
    setDraft(result.data);
    onSave(result.data);
  };
  return <div className="profile-layout">
    <section className="panel profile-card">
      <div className="profile-card-heading"><span className="profile-icon"><CircleUserRound size={26}/></span><div><h2>Meus dados</h2><p>Personalize seu perfil de demonstração.</p></div></div>
      <div className="local-notice"><Info size={18}/><p>Estes dados ficam somente neste navegador. Este perfil não cria uma conta nem altera o acesso ao sistema.</p></div>
      <form onSubmit={onSubmit} noValidate>
        <div className="profile-fields two"><label className="field">Nome<input autoComplete="given-name" value={draft.firstName} onChange={event => setDraft({ ...draft, firstName: event.target.value })} maxLength={60}/></label><label className="field">Sobrenome<input autoComplete="family-name" value={draft.lastName} onChange={event => setDraft({ ...draft, lastName: event.target.value })} maxLength={80}/></label></div>
        <label className="field">E-mail de contato (opcional)<input type="email" autoComplete="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} maxLength={254}/><small>Não é usado para login nesta versão.</small></label>
        <div className="profile-fields phone"><div className="field"><span>Código do país</span><input value="+55 (BR)" disabled aria-label="Código do país"/></div><label className="field">DDD<input inputMode="numeric" autoComplete="tel-area-code" value={draft.phoneArea} onChange={event => setDraft({ ...draft, phoneArea: event.target.value.replace(/\D/g, "").slice(0, 2) })}/></label><label className="field">Número<input inputMode="numeric" autoComplete="tel-local" value={draft.phoneNumber} onChange={event => setDraft({ ...draft, phoneNumber: event.target.value.replace(/\D/g, "").slice(0, 9) })}/></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="profile-actions"><button className="button primary" type="submit"><Save size={16}/> Salvar meus dados</button></div>
      </form>
    </section>
    <aside className="profile-side"><div className="panel"><ShieldCheck size={20}/><h3>Seu acesso</h3><p>O hash de senhas e o seed de papéis estão preparados no servidor, mas o login ainda não foi ativado. Dados deste perfil não definem permissões.</p></div></aside>
  </div>;
}
