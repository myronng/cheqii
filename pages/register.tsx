import { RegisterPage } from "components/auth/Register";
import localeSubset from "locales/register.json";
import { InferGetServerSidePropsType } from "next";
import { getAuthUser } from "services/authenticator";
import { getLocaleStrings } from "services/locale";
import { withContextErrorHandler } from "services/middleware";

export type RegisterPageProps = InferGetServerSidePropsType<typeof getServerSideProps>;

const Page = (props: RegisterPageProps) => <RegisterPage {...props} />;

export const getServerSideProps = withContextErrorHandler(async (context) => {
  const authUser = await getAuthUser(context);
  if (authUser && !authUser.isAnonymous) {
    return {
      redirect: {
        permanent: false,
        destination: "/",
      },
    };
  }
  const strings = getLocaleStrings(localeSubset, context.locale);
  return {
    props: {
      strings,
      // fetchSite: context.req.headers["sec-fetch-site"],
    },
  };
});

export default Page;
