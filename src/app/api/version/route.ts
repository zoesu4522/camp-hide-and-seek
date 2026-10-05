/** 目前部署的版本號（build 時產生的靜態回應） */
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" });
}
