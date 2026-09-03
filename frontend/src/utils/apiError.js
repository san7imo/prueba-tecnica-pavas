const DEFAULT_MESSAGE = 'No fue posible completar la operación. Intenta nuevamente.';

export const getApiError = (error, fallback = DEFAULT_MESSAGE) => {
  const apiError = error?.response?.data?.error;

  if (typeof apiError?.message === 'string' && apiError.message.trim()) {
    return {
      code: typeof apiError.code === 'string' ? apiError.code : 'API_ERROR',
      message: apiError.message,
      details: apiError.details && typeof apiError.details === 'object' ? apiError.details : [],
      status: error.response.status,
    };
  }

  return {
    code: 'REQUEST_FAILED',
    message: fallback,
    details: [],
    status: error?.response?.status,
  };
};

export const getApiErrorMessage = (error, fallback) =>
  getApiError(error, fallback).message;
