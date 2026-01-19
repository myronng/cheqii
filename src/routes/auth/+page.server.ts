export const load = async ({ cookies }) => {
  const authRedirect = cookies.get("authRedirect");
  return {
    authRedirect,
  };
};
