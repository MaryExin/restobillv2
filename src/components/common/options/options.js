import useCustomQuery from "../../../hooks/useCustomQuery";
import useZustandLoginCred from "../../../context/useZustandLoginCred";
import useZustandAPIEndpoint from "../../../context/useZustandAPIEndpoint";

export const panelToolsAccounting = [
  {
    tittle: "Setup",
    delay: 0,
    link: "accountingsetup",
  },
  {
    tittle: "Disbursments",
    delay: 0,
    link: "disbursements",
  },
  {
    tittle: "Journal Voucher",
    delay: 0,
    link: "journalvoucher",
  },
  {
    tittle: "Deposits",
    delay: 0.1,
    link: "deposits",
  },
  {
    tittle: "Closing Accounting Period",
    delay: 0.1,
    link: "closingaccountingentries",
  },
  {
    tittle: "Referral Information",
    delay: 0.1,
    link: "referral",
  },
  {
    tittle: "Petty Cash",
    delay: 0.2,
    link: "pettycashfund",
  },
  {
    tittle: "Fixed Assets",
    delay: 0.2,
    link: "fixedasset",
  },
];

export const useFilteredBusunits = () => {
  const { roles } = useZustandLoginCred();
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const { data: busunits } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT,
    "busunits"
  );

  if (!Array.isArray(busunits) || busunits.length === 0 || !roles?.length) {
    return { filteredBusUnits: [] };
  }

  const filteredBusUnits = roles[0].reduce((acc, role) => {
    const matchingBusunit = busunits.find(
      (busunit) => busunit.busunitcode === role.rolename
    );
    if (matchingBusunit) {
      acc.push({ ...role, ...matchingBusunit });
    }
    return acc;
  }, []);

  return { filteredBusUnits };
};

export const useFilteredGl = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const { data: qryglData } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_GL_NAME_ENDPOINT,
    "GL Account"
  );

  const glOptions = Array.isArray(qryglData)
    ? qryglData.map((gl) => ({
        id: gl.glcode,
        optionItem: `${gl.glcode} - ${gl.gldescription}`,
      }))
    : [];

  return { glOptions };
};

// useFilteredRawMats.js
export const useFilteredRawMats = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const { data: rawMatsData, refetch: rawMatsDatareftech  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAM_DISTINCT_RAWMATS_DATA_READ_ENDPOINT,
    "rawmats"
  );

  const rawMatsOptions = Array.isArray(rawMatsData)
    ? rawMatsData.map((mat) => ({
        id: mat.mat_code,
        desc: `${mat.desc} | ${mat.level} (${
          mat.uomval
        } ${mat.uom.toLowerCase()})`,
      }))
    : [];

  return { rawMatsOptions, rawMatsDatareftech };
};
export const useFilteredProduct = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const { data: buildData, refetch: buildDatareftech  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_DISTINCT_BUILDS_READ_ENDPOINT,
    "builds"
  );

  const buildDataOptions = Array.isArray(buildData)
    ? buildData.map((data) => ({
        id: data.build_code,
        desc: `${data.desc} | ${data.level} | (${
          data.category
        } ${data.uom.toLowerCase()})`,
      }))
    : [];

  return { buildDataOptions,  buildDatareftech};
};

//users options

export const useFilteredUsers = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const { data: usersData } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMEMPLOYEES_DATA_READ_ENDPOINT,
    "users"
  );

  const usersOptions = Array.isArray(usersData)
    ? usersData.map((user) => ({
        id: user.empid,
        name: user.fullname,
      }))
    : [];

  return { usersOptions };
};

export const useFilteredBuilds = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const { data: buildData } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_DISTINCT_BUILDS_READ_ENDPOINT,
    "builds"
  );

  const buildsOptions = Array.isArray(buildData)
    ? buildData.map((build) => ({
        id: build.build_code,
        name: `${
          build.desc
        } | ${build.level.toLowerCase()} | ${build.category.toLowerCase()} (${
          build.uomval
        } ${build.uom.toLowerCase()})`,
      }))
    : [];

  return { buildsOptions };
};
