/** Cancels an alert even when scheduling finishes after pause/close. */
export function pendingTimerAlert(
  schedule: (cancelled: () => boolean) => Promise<string | undefined>,
  cancel: (id: string) => Promise<void>,
  onScheduled: () => void,
  onError: () => void,
) {
  let stopped = false;
  let notificationId: string | undefined;
  const done = schedule(() => stopped)
    .then(async (id) => {
      notificationId = id;
      if (!id) return;
      if (stopped) await cancel(id);
      else onScheduled();
    })
    .catch(() => {
      if (!stopped) onError();
    });
  return {
    done,
    stop() {
      stopped = true;
      if (notificationId) void cancel(notificationId).catch(() => undefined);
    },
  };
}
