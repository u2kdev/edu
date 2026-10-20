import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const LeadSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(9).max(30),
  organizationName: z.string().min(2).max(150),
  notes: z.string().max(500).optional(),
  locale: z.enum(["uz", "ru"]).optional(),
  plan: z.string().max(50).optional(),
  source: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: "Lead received successfully",
      lead: {
        fullName: parsed.data.fullName,
        organizationName: parsed.data.organizationName,
        plan: parsed.data.plan || "general",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
