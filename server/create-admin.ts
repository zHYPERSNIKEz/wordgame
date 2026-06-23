import 'dotenv/config';
import { hashPassword } from './auth.js';
import { upsertUser, getUserByOpenId, updateUser } from './db.js';

async function main() {
  console.log("Criando usuário administrador...");
  
  const email = "admin@admin.com";
  const password = "adminpassword";
  const passwordHash = await hashPassword(password);
  
  const openId = `email:${email}`;
  
  await upsertUser({
    openId,
    name: "Admin",
    email: email,
    passwordHash,
    age: 30,
    loginMethod: "password",
    role: "admin",
  });
  
  console.log("Admin criado com sucesso!");
  console.log("Email: " + email);
  console.log("Senha: " + password);
  process.exit(0);
}

main().catch(console.error);
