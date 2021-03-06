import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { ethers } from "ethers";

// vercel build apes out if I don't include the .d.ts extension
//@ts-ignore
import { Game } from "../typechain/Game.d.ts";
import { GameFactory } from "../typechain/GameFactory";
import DappContext from "./Dapp";
import { abis as _abis } from "../contracts";

type Optional<T> = T | undefined;
type Contract = ethers.Contract;
type Address = string;

type ContractsContextType = {
  whiteElephant: {
    contract?: Game;
  };
  erc721: {
    contract: (at: string) => Optional<Contract>;
    approve: (at: string, operator: string, tokenId?: string) => Promise<void>;
    isApproved: (
      at: string,
      operator: string,
      tokenId?: string
    ) => Promise<boolean>;
  };
};

const DefaultContractsContext = {
  whiteElephant: {},
  erc721: {
    contract: () => {
      throw new Error("must be implemented");
    },
    approve: () => {
      throw new Error("must be implemented");
    },
    isApproved: () => {
      throw new Error("must be implemented");
    },
  },
};

const ContractsContext = createContext<ContractsContextType>(
  DefaultContractsContext
);

export const ContractsContextProvider: React.FC = ({ children }) => {
  const { signer, addresses, abis, address } = useContext(DappContext);
  const [elephantContract, setElephantContract] = useState<Game>();
  const getContract = useCallback(async () => {
    if (!addresses || !signer || !abis.whiteElephant) {
      console.debug("no addresses, signer, or abi");
      return null;
    }
    console.debug(
      `instantiating the contract with ${addresses.whiteElephant}, abi and signer`
    );
    const _game = GameFactory.connect(
      "0xD1A68A3a9e6d30fa0f2760b8998c62E67BeCb20A",
      signer
    );
    const game = _game.connect(signer);
    setElephantContract(game);
  }, [addresses, signer, abis]);

  const getContractErc721 = useCallback(
    (at: Address) => {
      if (!signer) return;
      const contract = new ethers.Contract(at, _abis.erc721, signer);
      return contract;
    },
    [signer]
  );

  const approveErc721 = useCallback(
    async (at: Address, operator: Address, tokenId?: string) => {
      const contract = getContractErc721(at);
      if (!contract) {
        console.info("could not get erc721 contract");
        return;
      }
      let tx;
      if (tokenId) {
        tx = await contract.approve(operator, tokenId);
      } else {
        tx = await contract.setApprovalForAll(operator, true);
      }
      await tx.wait();
    },
    [getContractErc721]
  );

  const _isApprovedErc721 = useCallback(
    async (contract: ethers.Contract, tokenId: string) => {
      if (!addresses.whiteElephant || !contract) return false;
      const account = await contract.getApproved(tokenId);
      return account.toLowerCase() === addresses.whiteElephant.toLowerCase();
    },
    [addresses.whiteElephant]
  );

  const isApprovedErc721 = useCallback(
    async (at: Address, operator: Address, tokenId?: string) => {
      const contract = getContractErc721(at);
      if (!contract) {
        console.info("could not get erc721 contract");
        return false;
      }
      if (!signer) {
        console.info("signer is not ready");
        return false;
      }
      if (!address) {
        console.info("metamask is not connected");
        return false;
      }
      let itIs = false;
      try {
        itIs = await contract.isApprovedForAll(address, operator);
      } catch (err) {
        console.error(err);
      }
      if (itIs) return true;
      if (!tokenId) return false;
      itIs = await _isApprovedErc721(contract, tokenId);

      return itIs;
    },
    [signer, getContractErc721, _isApprovedErc721, address]
  );

  useEffect(() => {
    getContract();
  }, [getContract]);

  return (
    <ContractsContext.Provider
      value={{
        whiteElephant: { contract: elephantContract },
        erc721: {
          contract: getContractErc721,
          approve: approveErc721,
          isApproved: isApprovedErc721,
        },
      }}
    >
      {children}
    </ContractsContext.Provider>
  );
};

export default ContractsContext;
