imgonload = (img, loader, asset, cb) ->
  img.onload = ->
    loader.loaded[asset] = true
    loader.numLoaded++

    if loader.doneLoading()
      loader.loading = false
      cb() if cb?

exports.AssetLoader = class AssetLoader
  instance = null
  assetsDirectory = "img/"

  #singleton instantiator
  @getInstance: ->
    if not instance?
      instance = new @
    return instance

  clone: -> instance

  constructor: ->
    @assets = []
    @loaded = []
    @loading = false

    # add images here: key -> url.
    # use getAsset(key) to access them later.
    @urls =
      checkpoint0: "checkpoint0.png"
      checkpoint1: "checkpoint1.png"
      checkpoint_checked0: "checkpoint_checked0.png"
      checkpoint_checked1: "checkpoint_checked1.png"
      dock: "dock.png"
      marker0: "marker0.png"
      marker1: "marker1.png"
      marker2: "marker2.png"
      marker3: "marker3.png"
      marker_shadow: "marker_shadow.png"
      smoke0: "smoke1.png"
      smoke1: "smoke2.png"
      smoke2: "circle4.png"
      go0: "go0.png"
      go1: "go1.png"
      getready0: "getready0.png"
      getready1: "getready1.png"
      mine0: "mine0.png"
      mine1: "mine1.png"
      boat0: "boat0.png"
      boat1: "boat1.png"
      boat2: "boat2.png"
      boat3: "boat3.png"
      gold: "gold.png"
      sparkle0: "sparkle0.png"
      sparkle1: "sparkle1.png"
      getthegold: "getthegold.png"

    @numAssets = 27
    @numLoaded = 0

  doneLoading: ->
    @numLoaded == @numAssets

  load: (cb = null) ->
    if @doneLoading() or @loading
      return

    @loading = true
    for asset, url of @urls
      @loaded[asset] = false

      @assets[asset] = new Image
      @assets[asset].name = asset

      imgonload(@assets[asset], this, asset, cb)

      @assets[asset].src = assetsDirectory + url

  getAsset: (name) ->
    # if not @loaded[name]
    #   return null
    return @assets[name]