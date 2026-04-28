let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const buildAuthHeaders = () => {
  if (accessToken) {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return {};
};
