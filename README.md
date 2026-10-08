# blockreaction.nyc

To run this page on your own:

* Fork the Repo on Github. 
* Replace CNAME with your sitename or delete the file if you don't have a custom domain. 
* Turn on Github Domains.

To convert new film stills to AVIF, install Python 3.10+ and Pillow with AVIF support:

```sh
python3 -m pip install 'Pillow>=11.3'
python3 scripts/convert-images.py assets/pics/estate --remove-originals
```

Pass one or more image files or folders. The script converts PNG/JPEG images at
their original dimensions, verifies the outputs, and updates image references in
HTML, CSS, and JavaScript. Quality defaults to 80; use `--quality 90` to change it.
Omit `--remove-originals` to keep the source images. Existing AVIF files are never
overwritten; a folder containing only AVIF files needs no further conversion.
