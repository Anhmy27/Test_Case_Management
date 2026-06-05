import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function toQueryString(searchParams: SearchParams) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      query.set(key, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function AdminTestRunsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  redirect(`/workspace/admin/test-runs-execution${toQueryString(params)}`);
}
