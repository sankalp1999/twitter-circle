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
            in 
            {
                packages = {
                    default = pkgs.stdenv.mkDerivation {
                        name = "twt-circle";
                        src = ./.;   
                        buildInputs = [
                            pkgs.git
                            pkgs.nodejs_18
                        ];

                        builder = ./setup.sh; 

                        installPhase = ''
                            echo $out
                        '';
                    };
                };
            }
        );
}
