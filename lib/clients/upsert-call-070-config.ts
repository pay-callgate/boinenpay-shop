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

/** client_call_070_configs 단일 행 upsert (callcloud_registered 유지·신규 시 false) */
export async function upsertClientCall070Config(
  supabase: SupabaseClient,
  clientId: string,
  fields: UpsertCall070Fields
) {
  const call070 = String(fields.call070Number).trim();
  const { data: existing } = await supabase
    .from("client_call_070_configs")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) {
    const { data: config, error } = await supabase
      .from("client_call_070_configs")
      .update({
        call_070_number: call070,
        greeting_message: fields.greetingMessage ?? null,
        industry: fields.industry ?? null,
        admin_name: fields.adminName ?? null,
        admin_email: fields.adminEmail ?? null,
        admin_phone: fields.adminPhone ?? null,
        sms_text_template: fields.smsTextTemplate ?? null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return config;
  }

  const { data: config, error } = await supabase
    .from("client_call_070_configs")
    .insert({
      client_id: clientId,
      call_070_number: call070,
      greeting_message: fields.greetingMessage ?? null,
      industry: fields.industry ?? null,
      admin_name: fields.adminName ?? null,
      admin_email: fields.adminEmail ?? null,
      admin_phone: fields.adminPhone ?? null,
      sms_text_template: fields.smsTextTemplate ?? null,
      callcloud_registered: false,
    })
    .select()
    .single();

  if (error) throw error;
  return config;
}
