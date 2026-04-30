import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildIntegrationIntranetPostSampleFields,
  maskIntranetPostFieldsForClient,
} from "@/lib/newrun/integration-intranet-post-sample";
import { encodeNewrunIntranetPostBody } from "@/lib/newrun/euc-kr-wire";
import { parseIntranetPostResponse, buildIntranetPostReturnSnapshot } from "@/lib/newrun/parse-intranet-post-response";
import { getNewrunCredentialsFromEnv } from "@/lib/newrun/submit-order";

export const dynamic = "force-dynamic";

const DEFAULT_INTRANET_POST_URL = "http://ext2intra.roseweb.co.kr/intranet_post.html";

function intranetPostUrl(): string {
  return (process.env.NEWRUN_INTRANET_POST_URL ?? DEFAULT_INTRANET_POST_URL).trim();
}

async function gatePartnerAdmin(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  const supabase = createServerSupabase();
  const { data: rows, error } = await supabase
    .from("partner_admins")
    .select("id")
    .eq("user_id", session.user.id)
    .limit(1);
  if (error || !rows?.length) {
    return {
      ok: false,
      response: NextResponse.json({ error: "파트너 관리자 권한이 없습니다." }, { status: 403 }),
    };
  }
  return { ok: true };
}

function envHints() {
  return {
    NEWRUN_ROSEWEB_ID: Boolean(process.env.NEWRUN_ROSEWEB_ID?.trim()),
    NEWRUN_ASSOC_INTRANET_ID: Boolean(process.env.NEWRUN_ASSOC_INTRANET_ID?.trim()),
    NEWRUN_ROSEWEB_PW: Boolean(process.env.NEWRUN_ROSEWEB_PW?.trim()),
    NEWRUN_ASSOC_CODE: Boolean(process.env.NEWRUN_ASSOC_CODE?.trim()),
    NEWRUN_RW_ASSOCID: Boolean(process.env.NEWRUN_RW_ASSOCID?.trim()),
    NEWRUN_RW_RETURNURL: Boolean(process.env.NEWRUN_RW_RETURNURL?.trim()),
    NEWRUN_INTRANET_POST_URL: Boolean(process.env.NEWRUN_INTRANET_POST_URL?.trim()),
    NEWRUN_INTEGRATION_TEST_SUJUID: Boolean(process.env.NEWRUN_INTEGRATION_TEST_SUJUID?.trim()),
    NEWRUN_DEFAULT_RW_SENDPEOPLE: Boolean(process.env.NEWRUN_DEFAULT_RW_SENDPEOPLE?.trim()),
  };
}

/**
 * GET: intranet_post 샘플 Payload 미리보기(비밀번호 마스킹, 결제·주문 DB 불필요)
 * POST `{ "execute": true }`: 동일 Payload로 실제 intranet_post 전송 후 응답 요약
 */
export async function GET() {
  const gate = await gatePartnerAdmin();
  if (!gate.ok) return gate.response;

  const { fields, warnings, blockingIssues } = buildIntegrationIntranetPostSampleFields();
  const credsOk = getNewrunCredentialsFromEnv() != null;

  return NextResponse.json({
    intranetPostUrl: intranetPostUrl(),
    fields: maskIntranetPostFieldsForClient(fields),
    warnings,
    blockingIssues,
    envHints: envHints(),
    credsOk,
    note:
      "샘플 주문·배송지·리본은 고정값입니다. 수주화원 ID(rw_sujuid)는 env NEWRUN_INTEGRATION_TEST_SUJUID(미설정 시 sinil275)입니다. 실제 전송 시 뉴런 접수가 될 수 있으니 운영 계정 주의.",
  });
}

export async function POST(request: NextRequest) {
  const gate = await gatePartnerAdmin();
  if (!gate.ok) return gate.response;

  let body: { execute?: boolean } = {};
  try {
    const t = (await request.json()) as unknown;
    if (t && typeof t === "object" && !Array.isArray(t)) body = t as { execute?: boolean };
  } catch {
    /* 빈 본문 */
  }

  if (!body.execute) {
    return NextResponse.json({ error: '본문에 { "execute": true } 가 필요합니다.' }, { status: 400 });
  }

  const creds = getNewrunCredentialsFromEnv();
  if (!creds) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "뉴런 발주 env가 없습니다. NEWRUN_ROSEWEB_ID, NEWRUN_ROSEWEB_PW, NEWRUN_RW_RETURNURL(·NEWRUN_ASSOC_CODE 등)을 확인해 주세요.",
        envHints: envHints(),
      },
      { status: 400 }
    );
  }

  const { fields, warnings, blockingIssues } = buildIntegrationIntranetPostSampleFields();
  const url = intranetPostUrl();
  const postBody = encodeNewrunIntranetPostBody(fields);

  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=EUC-KR",
      },
      body: postBody,
    });
    const bodyText = await res.text();
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("Location") : null;
    const parsed = parseIntranetPostResponse({
      status: res.status,
      bodyText,
      locationHeader: location,
    });
    const newrunResponse = buildIntranetPostReturnSnapshot(parsed);

    return NextResponse.json({
      ok: true,
      newrunResponse,
      intranetPostUrl: url,
      httpStatus: res.status,
      location,
      bodySnippet: bodyText.slice(0, 1200),
      parsed,
      fieldsSent: maskIntranetPostFieldsForClient(fields),
      warnings,
      blockingIssues,
      envHints: envHints(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "네트워크 오류";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        fieldsSent: maskIntranetPostFieldsForClient(fields),
        intranetPostUrl: url,
        envHints: envHints(),
      },
      { status: 502 }
    );
  }
}
