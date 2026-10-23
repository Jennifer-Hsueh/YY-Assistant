// APP 版(--mode native)沒有 service worker,用這個空的替身
export function useRegisterSW() {
  return { needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} };
}
