// Legacy like endpoint (`POST /api/confessions/:id`); kept as an alias of the `/like` route
// so both URLs share the atomic, rate-limited implementation.
export { POST } from '@/app/api/confessions/[id]/like/route';
