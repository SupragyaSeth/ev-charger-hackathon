import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  if (!email.endsWith("@credosemi.com")) {
    return NextResponse.json(
      { error: "Must sign up with Credo email." },
      { status: 403 }
    );
  }
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
