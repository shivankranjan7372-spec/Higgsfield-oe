import { route } from "@/server/http";
import { listLibrary, parseLibraryQuery } from "@/server/library/listing";

/** GET /api/library?kind=&source=&favorite=1&folder=<id>|none&model=a,b&from=&to=&q=&sort=&limit=&cursor= */
export const GET = route(({ req, user }) => ({ ...listLibrary(user.id, parseLibraryQuery(req.nextUrl.searchParams)) }));
