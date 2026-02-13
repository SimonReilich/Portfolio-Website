{
  # description = "description";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
      name = "portfolio";
      version = "v0.1.0";
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.buildNpmPackage {
            pname = name;
            version = version;
            src = ./.;

            npmDepsHash = "sha256-OcBHjWPjYDLQqrrzlazUi5lyjYbJma+nck8ijp74JC0=";

            NG_CLI_ANALYTICS = "false";

            npmBuildScript = "build";
            
            installPhase = ''
              mkdir -p $out/share/www
              cp -r dist/${name}/browser/* $out/share/www
              
              mkdir -p $out/bin
              cat <<EOF > $out/bin/${name}
              #!/bin/sh
              echo "Starting server at http://localhost:8080"
              ${pkgs.python3}/bin/python3 -m http.server 8080 --directory $out/share/www
              EOF
              chmod +x $out/bin/${name}
            '';
          };
        }
      );

      apps = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          devScript = pkgs.writeShellScriptBin "run-dev" ''
            ng serve
          '';
        in
        {
          default = {
            type = "app";
            program = "${self.packages.${system}.default}/bin/${name}";
            meta = {
              # description = "description";
            };
          };
          dev = {
            type = "app";
            program = "${devScript}/bin/run-dev";
            meta = {
              description = "live-reloding for development";
            };
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_24
              nodePackages.npm
              pkg-config
            ];

            shellHook = ''
              export PATH=$PWD/node_modules/.bin:$PATH
            '';
          };
        }
      );
    };
}
