{
    description = "sankalp's twitter circle";
    
    inputs = {
        nixpkgs.url = "github:nixos/nixpkgs/23.11";
        utils.url = "github:numtide/flake-utils";
    };

    outputs = { self, utils, nixpkgs }:
        utils.lib.eachDefaultSystem (system:
            let 
                pkgs = import nixpkgs { inherit system; };
            in with pkgs;
            {
                devShells = {
                    default = mkShell {
                        buildInputs = [
                            nodejs
                        ];

                        shellHook = '' 
                            npm install
                        '';
                    };
                };
            }
        );
}
