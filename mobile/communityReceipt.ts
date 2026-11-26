import type { Post } from './types';

/** Capture credentials before queuing React updates; never mutate the server response. */
export function communityReceipt(response: Post) {
  const { ownerToken, ownedCommentId, ...post } = response;
  const grant = ownerToken ? { id: ownedCommentId || response.id, token: ownerToken } : null;
  return { post, grant };
}
