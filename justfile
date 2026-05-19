deploy:
    forge script script/DeployFunctions.s.sol:DeployFunctions --rpc-url sepolia --account default --broadcast --verify

deploy-core:
    forge script script/DeployCore.s.sol:DeployCore --rpc-url sepolia --account default --broadcast --verify
