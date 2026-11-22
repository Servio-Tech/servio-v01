import { matchesUser } from "./ownerUtils.js";

export async function fetchOwnerPage(callOwner, page) {
  const data = await callOwner("list", { page });
  if (!data || !Array.isArray(data.users) || typeof data.has_more !== "boolean" || Number(data.page) !== page || (data.has_more && data.users.length === 0)) {
    throw new Error("Invalid pagination response from owner service");
  }
  return data;
}

export async function searchOwnerDirectory(callOwner, query, { isActive = () => true, onProgress = () => {}, maxPages = 1000 } = {}) {
  const matches = [];
  const seenIds = new Set();
  let page = 1;
  let more = true;
  while (more) {
    if (page > maxPages) throw new Error("Search exceeded the safe pagination limit");
    const data = await fetchOwnerPage(callOwner, page);
    if (!isActive()) return null;
    for (const user of data.users) {
      if (!user?.id || seenIds.has(user.id)) throw new Error("Invalid pagination response from owner service");
      seenIds.add(user.id);
      if (matchesUser(user, query)) matches.push(user);
    }
    more = data.has_more;
    onProgress(page);
    page += 1;
  }
  return { users: matches, pagesChecked: page - 1 };
}
