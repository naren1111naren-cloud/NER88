export const safeArray = (resData) => {
  if (Array.isArray(resData)) return resData;
  if (resData && Array.isArray(resData.data)) return resData.data;
  return [];
};

export const safeObject = (resData, fallback = {}) => {
  if (resData && typeof resData === 'object' && !Array.isArray(resData)) {
    if (resData.data && typeof resData.data === 'object' && !Array.isArray(resData.data)) {
      return resData.data;
    }
    return resData;
  }
  return fallback;
};
