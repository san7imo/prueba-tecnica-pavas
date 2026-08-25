let session = null;
let refreshHandler = null;
let refreshPromise = null;
let sessionRevision = 0;
const listeners = new Set();

const publish = (message = '') => {
  listeners.forEach((listener) => listener(session, message));
};

export const getAccessToken = () => session?.accessToken ?? null;

export const getSession = () => session;

export const subscribeToSession = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const configureRefreshHandler = (handler) => {
  refreshHandler = handler;
};

export const establishSession = (nextSession) => {
  session = {
    user: nextSession.user,
    accessToken: nextSession.accessToken,
  };
  publish();
  return session;
};

export const clearSession = (message = '') => {
  sessionRevision += 1;
  session = null;
  publish(message);
};

export const refreshAccessSession = () => {
  if (!refreshHandler) {
    return Promise.reject(new Error('Refresh handler is not configured.'));
  }

  if (!refreshPromise) {
    const revisionAtStart = sessionRevision;
    refreshPromise = Promise.resolve()
      .then(() => refreshHandler())
      .then((nextSession) => {
        if (revisionAtStart !== sessionRevision) {
          throw new Error('Session changed while refresh was in progress.');
        }
        return establishSession(nextSession);
      })
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const resetAuthSessionForTests = () => {
  session = null;
  refreshHandler = null;
  refreshPromise = null;
  sessionRevision = 0;
  listeners.clear();
};
