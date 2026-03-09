import React, { useEffect, useState } from "react";
import Home from "../../components/MainComponents/Home";
import ModalMobileMenu from "../../components/Modals/ModalMobileMenu";
import useZustandMobile from "../../context/useZustandMobile";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useCustomQueryNoAuth from "../../hooks/useCustomQueryNoAuth";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const HomePage = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const [isDashboard, setIsDashboard] = useState(true);
  const { isMobile, toggleIsMobile } = useZustandMobile();
  const { isDekstopSideMenu, toggleIsDesktopSideMenu } = useZustandSideMenu();

  const [initialIP, setInitialIP] = useState();
  const { ipAddress, setIpAddress } = useZustandLoginCred();

  const {
    data: ipAddressData,
    isLoading: ipAddressDataIsLoading,
    isError: ipAddressDataIsError,
    isSuccess: ipAddressDataIsSuccess,
  } = useCustomQueryNoAuth(
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_IP_ADDRESS,
    "ipaddress",
  );

  useEffect(() => {
    if (ipAddressData) {
      setInitialIP(ipAddressData.ip);
    }
  }, [ipAddressData]);

  useEffect(() => {
    // console.log(initialIP);
    setIpAddress(initialIP);
  }, [initialIP]);

  return (
    <>
      {isMobile && <ModalMobileMenu />}
      <div className="flex w-full  justify-center bg-gradient-to-br from-darkPrimary via-medPrimary to-softPrimary">
        <Home />
      </div>
    </>
  );
};

export default HomePage;
