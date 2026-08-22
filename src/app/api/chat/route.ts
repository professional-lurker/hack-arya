import { handleGatewayRequest } from "@/lib/gateway/middleware";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleGatewayRequest(req);
}
