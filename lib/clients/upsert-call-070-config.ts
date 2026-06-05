import type { SupabaseClient } from "@supabase/supabase-js";

export type UpsertCall070Fields = {
  call070Number: string;
  greetingMessage?: string | null;
  industry?: string | null;
  adminName?: string | null;
  adminEmail?: string | null;
  adminPhone?: string | null;
  smsTextTemplate?: string | null;
};

export type UpsertCall070Options = {
  /**
   * true: 이미 연동 완료된 거래처의 정보 변경 — callcloud_registered / call_070_connected 를 false 로 내리지 않음
   */
  preserveRegistration?: boolean;
};

/**
 * client_call_070_configs 단일 행 upsert.
 * 신규 연동(request-queue): preserveRegistration 미설정 → 미완료(false) 유지, 시트 「완료」·웹훅이 true 로 올림.
 * 정보 변경: preserveRegistration true → 연동 완료 플래그 유지.
 */
export async function upsertClientCall070Config(
  supabase: SupabaseClient,
  clientId: string,
  fields: UpsertCall070Fields,
  options?: UpsertCall070Options
) {
  const call070 = String(fields.call070Number).trim();
  const preserve = options?.preserveRegistration === true;

  const { data: existing } = await supabase
    .from("client_call_070_configs")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  const configFields = {
    call_070_number: call070,
    greeting_message: fields.greetingMessage ?? null,
    industry: fields.industry ?? null,
    admin_name: fields.adminName ?? null,
    admin_email: fields.adminEmail ?? null,
    admin_phone: fields.adminPhone ?? null,
    sms_text_template: fields.smsTextTemplate ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const updatePayload = preserve
      ? configFields
      : { ...configFields, callcloud_registered: false };

    const { data: config, error } = await supabase
      .from("client_call_070_configs")
      .update(updatePayload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;

    if (!preserve) {
      const { error: clientUpdErr } = await supabase
        .from("clients")
        .update({ call_070_connected: false })
        .eq("id", clientId);

      if (clientUpdErr) throw clientUpdErr;
    }

    return config;
  }

  const { data: config, error } = await supabase
    .from("client_call_070_configs")
    .insert({
      client_id: clientId,
      ...configFields,
      callcloud_registered: false,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: clientUpdErr } = await supabase
    .from("clients")
    .update({ call_070_connected: false })
    .eq("id", clientId);

  if (clientUpdErr) throw clientUpdErr;
  return config;
}
