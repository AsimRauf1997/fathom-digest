import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/login", "/signup", "/sso-callback"]);
const isPublicWhenSignedOut = createRouteMatcher(["/"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (isPublicRoute(req)) {
    if (userId && !req.nextUrl.pathname.startsWith("/sso-callback")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  if (isPublicWhenSignedOut(req) && !userId) {
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
