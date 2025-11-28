import { ACTIONS_CORS_HEADERS, ActionsJson } from "@solana/actions";

export const GET = async () => {
  const payload: ActionsJson = {
    rules: [
      // Map all bet routes to action
      {
        pathPattern: "/bet/*",
        apiPath: "/api/actions/bet/*",
      },
      // Fallback to homepage
      {
        pathPattern: "/*",
        apiPath: "/api/actions/*",
      },
    ],
  };

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
};

// Required for OPTIONS preflight requests
export const OPTIONS = GET;
