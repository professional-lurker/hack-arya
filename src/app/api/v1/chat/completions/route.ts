/**
 * AI Gateway endpoint — the core of the platform.
 *
 * POST /api/v1/chat/completions
 * Authorization: Bearer tmp_xxxxxxxxx
 *
 * Compatible with OpenAI chat completions format.
 * Internally routes to the correct AI provider based on the sandbox key.
 */

import { handleGatewayRequest } from "@/lib/gateway/middleware";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  return handleGatewayRequest(req);
}

// Standard App Router configuration
export const dynamic = "force-dynamic";
export const maxDuration = 60;

