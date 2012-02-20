rm -rf ./public/paradocks
mkdir -p ./public/paradocks
cp -R ./pokki/* ./public/paradocks/
sed '/Pokki/d' ./public/paradocks/popup.html > ./public/paradocks/index.html 
rm -f ./public/paradocks/popup.html
rm -f ./public/paradocks/manifest.json