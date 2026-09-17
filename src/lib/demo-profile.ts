import { z } from "zod";

export const emptyDemoProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phoneArea: "",
  phoneNumber: "",
};

export const demoProfileSchema = z.strictObject({
  firstName: z.string().trim().min(2, "Informe seu nome com pelo menos 2 caracteres.").max(60),
  lastName: z.string().trim().max(80),
  email: z.union([z.literal(""), z.email("Informe um e-mail válido.").max(254)]),
  phoneArea: z.union([z.literal(""), z.string().regex(/^\d{2}$/, "Informe um DDD com 2 dígitos.")]),
  phoneNumber: z.union([z.literal(""), z.string().regex(/^\d{8,9}$/, "Informe um número com 8 ou 9 dígitos.")]),
}).refine(value => (value.phoneArea === "") === (value.phoneNumber === ""), {
  message: "Preencha DDD e número juntos.", path: ["phoneNumber"],
});

export type DemoProfile = z.infer<typeof demoProfileSchema>;
