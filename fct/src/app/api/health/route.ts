export async function GET() {
  return Response.json({ ok: true, app: "fct", fcmIntegration: !!process.env.FCM_BRIDGE_SECRET });
}
