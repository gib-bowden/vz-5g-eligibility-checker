// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as parser from "parse-address";
import axios, { AxiosResponse } from "axios";
import { read, utils, write } from "xlsx";
import mockData from "./mocks/vzResponseMock.json";
import { readFileSync, writeFileSync } from "fs";
import { app } from "electron";
// eslint-disable-next-line @typescript-eslint/no-var-requires

type ParsedAddress = {
  number: string;
  street: string;
  type: string;
  city: string;
  state: string;
  zip: string;
  sec_unit_type?: string;
  sec_unit_num?: string;
};

type ResultRow = {
  inputAddress: string;
  verizonAddress: string;
  eligible5g: boolean;
  eligibleLTE: boolean;
};

type EligiblityResponse = {
  output: {
    qualified: boolean;
    reservation: boolean;
    emailAddress: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    zipCode: string;
    reasonCode: string;
    addressType: string;
    installType: string;
    floorToStreetsMap: unknown;
    phoneNumber: string;
    addressfromAccount: boolean;
    currentFloorNumber: string;
    verifyE911Address: boolean;
    launchType: string;
    apartmentNumberRequired: boolean;
    floorPlanAvailable: boolean;
    addressMapStatus: string;
    maxFloor: string;
    buildingDetails: string;
    uberPinEligible: boolean;
    intersectionCoordinatesLst: unknown;
    coveragePercentage: unknown;
    equipType: unknown;
    addressDescriptorList: unknown;
    bundleNames: unknown;
    addressId: string;
    subLocationId: string;
    qualified4GHome: boolean;
    qualifiedCBand: boolean;
    preOrder5GFlow: boolean;
    preOrderLaunchDate: string;
    isExpiredCart: boolean;
    isStreetSelected: boolean;
    isRevisitor: boolean;
    uberPinQualificatioIsRequired: boolean;
    displayStreetSelection: boolean;
    mucOfferEligible: boolean;
    storeSessionId: string;
  };
};

type RequestBody = {
  address1: string;
  city: string;
  state: string;
  zipcode: string;
  address2: string;
};

export const processFile = async (
  filePath: string
): Promise<string | undefined> => {
  const buf = readFileSync(filePath);
  const workbook = read(buf);
  // TODO: Could also do a for each sheet, if each sheet represents a market
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const inputRows: Array<string[]> = utils.sheet_to_json(firstSheet, {
    header: 1,
  });
  let addressIndex: number;
  const locations = inputRows
    .map((row, i) => {
      const isHeaderRow = i === 0;
      if (isHeaderRow) {
        addressIndex = row.findIndex((col) =>
          ["address", "addresses"].includes(col.toLowerCase())
        );
      } else {
        return row[addressIndex];
      }
    })
    .filter((location) => location);

  const requests: Promise<AxiosResponse<EligiblityResponse>>[] = [];
  for (const location of locations) {
    const address: ParsedAddress = parser.parseLocation(location);
    const requestBody: RequestBody = {
      address1: `${address.number} ${address.street} ${address.type}`,
      address2: address.sec_unit_type
        ? `${address.sec_unit_type} ${address.sec_unit_num}`
        : "",
      city: address.city,
      state: address.state,
      zipcode: address.zip,
    };
    requests.push(
      axios.post<EligiblityResponse>(
        "https://www.verizon.com/vfw/v1/check5GAvailability",
        requestBody
      )
    );
  }

  let results: AxiosResponse<EligiblityResponse>[];
  try {
    results = await Promise.all(requests);
  } catch (error) {
    console.log({ error });
    return;
  }

  // const results = mockData;
  const rowData = results.map((result, i): ResultRow => {
    console.log(locations[i], { data: result?.data });
    if (!result?.data?.output?.addressId) {
      return {
        inputAddress: locations[i],
        verizonAddress: "not found",
        eligible5g: null,
        eligibleLTE: null,
      };
    }
    const {
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      qualified,
      qualifiedCBand,
      qualified4GHome,
    } = result.data.output;
    return {
      inputAddress: locations[i],
      verizonAddress: `${addressLine1} ${addressLine2} ${city} ${state} ${zipCode}`,
      eligible5g: qualified || qualifiedCBand,
      eligibleLTE: qualified4GHome,
    };
  });

  const resultSheet = utils.json_to_sheet(rowData);

  utils.book_append_sheet(workbook, resultSheet, `${firstSheetName} Results`);
  const stats = {
    count: results.length,
    found: results.filter((result) => result.data?.output?.addressId).length,
    eligible5G: results.filter(
      (result) =>
        result.data?.output?.qualifiedCBand || result.data?.output?.qualified
    ).length,
    eligibleLTE: results.filter(
      (result) => result.data?.output?.qualified4GHome
    ).length,
    unitInputRequired: results.filter(
      (result) => result.data?.output?.apartmentNumberRequired
    ).length,
  };
  const statsSheet = utils.json_to_sheet([stats]);
  utils.book_append_sheet(workbook, statsSheet, `${firstSheetName} Stats`);
  const filePathArray = filePath.split("/");
  const originalFileName =
    filePathArray[filePathArray.length - 1].split(".")[0];
  const newFilePath = `${app.getPath(
    "downloads"
  )}/${originalFileName}_processed.xlsx`;

  try {
    const data = write(workbook, { type: "buffer" });
    writeFileSync(newFilePath, data);
    return newFilePath;
  } catch (error) {
    console.log(error);
  }
};
