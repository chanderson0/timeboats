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

    # add images here: key -> url.
    # use getAsset(key) to access them later.
    @urls =
      boat: "boat.png"
      checkpoint0: "checkpoint0.png"
      checkpoint1: "checkpoint1.png"
      checkpoint_checked0: "checkpoint_checked0.png"
      checkpoint_checked1: "checkpoint_checked1.png"
      dock: "dock.png"
      marker0: "marker0.png"
      marker1: "marker1.png"
      smoke0: "smoke1.png"
      smoke1: "smoke2.png"
      smoke2: "circle4.png"
      mine0: "mine0.png"
      mine1: "mine1.png"

    @numAssets = @urls.length
    @numLoaded = 0


  load: ->
    if @numLoaded == @numAssets
      return

    for asset, url of @urls
      @loaded[asset] = false
      @assets[asset] = new Image
      # @assets[asset].loader = @
      @assets[asset].name = asset

      @assets[asset].onLoad = () ->
        AssetLoader.getInstance().loaded[@name] = true
        AssetLoader.getInstance().numLoaded++

      @assets[asset].src = assetsDirectory + url

  getAsset: (name) ->
    # if not @loaded[name]
    #   return null
    return @assets[name]