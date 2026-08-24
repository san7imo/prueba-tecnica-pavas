import { useCallback, useEffect, useState } from 'react';

import { workOrdersApi } from '../../../api/workOrdersApi.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';

const EMPTY_META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };

export const useWorkOrders = (filters) => {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await workOrdersApi.list(filters);
      setOrders(result.data);
      setMeta(result.meta);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No fue posible consultar las órdenes.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // The effect synchronizes this view with the server whenever filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, [loadOrders]);

  return { orders, meta, loading, error, retry: loadOrders };
};
