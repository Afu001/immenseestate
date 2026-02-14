import MasterplanClient from "./MasterplanClient";

export default function MasterplanPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const adminParam = searchParams?.admin;
  const admin = (Array.isArray(adminParam) ? adminParam[0] : adminParam) === "1";

  return <MasterplanClient admin={admin} />;
}
