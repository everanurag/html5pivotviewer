//
//  HTML5 PivotViewer
//
//  Collection loader interface - used so that different types of data sources can be used
//
//  Original Code:
//    Copyright (C) 2011 LobsterPot Solutions - http://www.lobsterpot.com.au/
//    enquiries@lobsterpot.com.au
//
//  Enhancements:
//    Copyright (C) 2012-2013 OpenLink Software - http://www.openlinksw.com/
//
//  This software is licensed under the terms of the
//  GNU General Public License v2 (see COPYING)
//

///
/// Graph (histogram) View
///
PivotViewer.Views.GraphView = PivotViewer.Views.TileBasedView.subClass({
    init: function () {
        this._super();
        var that = this;
        this.buckets = [];
        this.Scale = 1;
        this.canvasHeightUIAdjusted = 0;
        this.titleSpace = 62;

        //Event Handlers
        $.subscribe("/PivotViewer/Views/Canvas/Click", function (evt) {
            if (!that.isActive)
                return;

            var selectedItem = null;
            var selectedTile = null;
            for (var i = 0; i < that.tiles.length; i++) {
                if (that.tiles[i].Contains(evt.x, evt.y)) {
                    selectedTile = that.tiles[i];
                    selectedItem = that.tiles[i].facetItem.Id;
                } else {
                    that.tiles[i].Selected(false);
                }
            }
	    that.handleSelection (selectedItem, selectedTile, evt.x);
	});

        $.subscribe("/PivotViewer/Views/Canvas/Hover", function (evt) {
            if (!that.isActive)
                return;
            $('.pv-viewarea-graphview-overlay-bucket').removeClass('graphview-bucket-hover');
            //determine bucket and select
            var bucketNumber = Math.floor((evt.x - that.offsetX) / that.columnWidth);
            var bucketDiv = $('#pv-viewarea-graphview-overlay-bucket-' + bucketNumber);
            bucketDiv.addClass('graphview-bucket-hover');
            //determine tile
            for (var i = 0; i < that.tiles.length; i++) {
                if (that.tiles[i].Contains(evt.x, evt.y))
                    that.tiles[i].Selected(true);
                else
                    that.tiles[i].Selected(false);
            }
        });

        $.subscribe("/PivotViewer/Views/Canvas/Zoom", function (evt) {
            if (!that.isActive)
                return;

            var oldScale = that.Scale;
            var preWidth = that.currentWidth;
            var preHeight = that.currentHeight;
            //Set the zoom time - the time it takes to zoom to the scale
            //if on a touch device where evt.scale != undefined then have no delay
            var zoomTime = evt.scale != undefined ? 0 : 1000;

            if (evt.scale != undefined) {
                if (evt.scale >= 1)
                    that.Scale += (evt.scale - 1);
                else {
                    that.Scale -= evt.scale;
                    that.Scale = that.Scale < 1 ? 1 : that.Scale;
                }
            } else if (evt.delta != undefined)
                that.Scale = evt.delta == 0 ? 1 : (that.Scale + evt.delta - 1);

            if (that.Scale == NaN)
                that.Scale = 1;

            var newWidth = (that.width - that.offsetX) * that.Scale;
            var newHeight = that.height * that.Scale;

            //if trying to zoom out too far, reset to min
            if (newWidth < that.width || that.Scale == 1) {
                that.currentOffsetX = that.offsetX;
                that.currentOffsetY = that.offsetY;
                that.currentWidth = that.width;
                that.currentHeight = that.height;
                that.canvasHeightUIAdjusted = that.height - that.offsetY - that.titleSpace;
                that.columnWidth = (that.width - that.offsetX) / that.buckets.length;
                that.Scale = 1;
                $('.pv-viewarea-graphview-overlay div').fadeIn('slow');
            } else {
                //adjust position to base scale - then scale out to new scale
                //Move the scaled position to the mouse location
                that.currentOffsetX = evt.x - (((evt.x - that.currentOffsetX) / oldScale) * that.Scale);

                //Work out the scaled position of evt.y and then calc the difference between the actual evt.y
                var scaledPositionY = ((evt.y - that.currentOffsetY) / oldScale) * that.Scale;
                that.currentOffsetY = evt.y - scaledPositionY;
                that.canvasHeightUIAdjusted = newHeight - (((that.offsetY + that.titleSpace)/oldScale) * that.Scale);

                that.currentWidth = newWidth;
                that.currentHeight = newHeight;
                that.columnWidth = newWidth / that.buckets.length;
                $('.pv-viewarea-graphview-overlay div').fadeOut('slow');
            }

            var rowscols = that.GetRowsAndColumns(that.columnWidth - 2, that.canvasHeightUIAdjusted, that.maxRatio, that.bigCount);
            that.SetVisibleTileGraphPositions(rowscols, that.currentOffsetX, that.currentOffsetY, true, true);

            //deselect tiles if zooming back to min size
            if (that.Scale == 1 && oldScale != 1) {
                for (var i = 0; i < that.tiles.length; i++) {
                    that.tiles[i].Selected(false);
                }
                that.selected = "";
                $.publish("/PivotViewer/Views/Item/Selected", [that.selected]);
            }
        });

        $.subscribe("/PivotViewer/Views/Canvas/Drag", function (evt) {
            if (!that.isActive)
                return;

            var dragX = evt.x;
            var dragY = evt.y;
            var noChangeX = false, noChangeY = false;
            that.currentOffsetX += dragX;
            that.currentOffsetY += dragY;

            //LHS bounds check
            if (dragX > 0 && that.currentOffsetX > that.offsetX) {
                that.currentOffsetX -= dragX;
                noChangeX = true;
            }
            //Top bounds check
            if (dragY > 0 && (that.currentOffsetY + that.canvasHeightUIAdjusted) > that.currentHeight + that.offsetY) {
                that.currentOffsetY -= dragY;
                noChangeY = true;
            }
            //RHS bounds check
            //if the current offset is smaller than the default offset and the zoom scale == 1 then stop drag
            if (that.currentOffsetX < that.offsetX && that.currentWidth == that.width) {
                that.currentOffsetX -= dragX;
                noChangeX = true;
            }
            if (dragX < 0 && (that.currentOffsetX) < -1 * (that.currentWidth - that.width)) {
                that.currentOffsetX -= dragX;
                noChangeX = true;
            }
            //bottom bounds check

            if (that.currentOffsetY < that.offsetY && that.currentHeight == that.height) {
                that.currentOffsetY -= dragY;
                noChangeY = true;
            }
            if (dragY < 0 && (that.currentOffsetY - that.offsetY) < -1 * (that.currentHeight - that.height)) {
                that.currentOffsetY -= dragY;
                noChangeY = true;
            }

            if (noChangeX && noChangeY)
                return;
            if (noChangeX)
                that.OffsetTiles(0, dragY);
            else if (noChangeY)
                that.OffsetTiles(dragX, 0);
            else
                that.OffsetTiles(dragX, dragY);
        });
    },
    Setup: function (width, height, offsetX, offsetY, tileMaxRatio) {
        this.width = width;
        this.height = height;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.maxRatio = tileMaxRatio;
        this.currentWidth = this.width;
        this.currentHeight = this.height;
        this.currentOffsetX = this.offsetX;
        this.currentOffsetY = this.offsetY;
        this.rowscols = null;
        this.bigCount = 0;
    },
    Filter: function (dzTiles, currentFilter, sortFacet, stringFacets) {
        var that = this;
        if (!Modernizr.canvas)
            return;

        Debug.Log('Graph View Filtered: ' + currentFilter.length);

        this.sortFacet = sortFacet;
        this.tiles = dzTiles;

        //Sort
        this.tiles = dzTiles.sort(this.SortBy(this.sortFacet, false, function (a) {
            return $.isNumeric(a) ? a : a.toUpperCase();
        }));
        this.currentFilter = currentFilter;

        this.buckets = this.Bucketize(dzTiles, currentFilter, this.sortFacet, stringFacets);

        this.columnWidth = (this.width - this.offsetX) / this.buckets.length;
        this.canvasHeightUIAdjusted = this.height -this.offsetY - this.titleSpace;

        //Find biggest bucket to determine tile size, rows and cols
        //Also create UI elements
        var uiElements = [];
        this.bigCount = 0;
       for (var i = 0; i < this.buckets.length; i++) {
            var styleClass = i % 2 == 0 ? "graphview-bucket-dark" : "graphview-bucket-light";
            uiElements[i] = "<div class='pv-viewarea-graphview-overlay-bucket " + styleClass + "' id='pv-viewarea-graphview-overlay-bucket-" + i + "' style='width: " + (Math.floor(this.columnWidth) - 4) + "px; height:" + (this.height - 2) + "px; left:" + ((i * this.columnWidth) - 2) + "px;'>";
            if (this.buckets[i].startRange == this.buckets[i].endRange)
                uiElements[i] += "<div class='pv-viewarea-graphview-overlay-buckettitle' style='top: " + (this.canvasHeightUIAdjusted + 4) + "px;'>" + this.buckets[i].startRange + "</div></div>";
            else
                uiElements[i] += "<div class='pv-viewarea-graphview-overlay-buckettitle' style='top: " + (this.canvasHeightUIAdjusted + 4) + "px;'>" + this.buckets[i].startRange + "<br/>to<br/>" + this.buckets[i].endRange + "</div></div>";

            if (this.bigCount < this.buckets[i].Ids.length) {
                this.bigCount = this.buckets[i].Ids.length;
            }
        }

        //remove previous elements
        var graphViewOverlay = $('.pv-viewarea-graphview-overlay');
        graphViewOverlay.css('left', this.offsetX + 'px');
        $('.pv-viewarea-graphview-overlay div').fadeOut('slow', function () { $(this).remove(); });
        graphViewOverlay.append(uiElements.join(''));
        $('.pv-viewarea-graphview-overlay div').fadeIn('slow');

        for (var i = 0; i < this.tiles.length; i++) {
            //setup tiles
            this.tiles[i]._locations[0].startx = this.tiles[i]._locations[0].x;
            this.tiles[i]._locations[0].starty = this.tiles[i]._locations[0].y;
            this.tiles[i].startwidth = this.tiles[i].width;
            this.tiles[i].startheight = this.tiles[i].height;

            var filterindex = $.inArray(this.tiles[i].facetItem.Id, currentFilter);
            //set outer location for all tiles not in the filter
            if (filterindex < 0) {
                this.SetOuterTileDestination(this.width, this.height, this.tiles[i]);
                this.tiles[i].start = PivotViewer.Utils.Now();
                this.tiles[i].end = this.tiles[i].start + 1000;
            }
        }

        // recalculate max width of images in filter
        that.maxRatio = that.tiles[0]._controller.GetRatio(that.tiles[0].facetItem.Img);
        for (var i = 0; i < that.tiles.length; i++) {
            var filterindex = $.inArray(that.tiles[i].facetItem.Id, currentFilter);
            if (filterindex >= 0) {
                if (that.tiles[i]._controller.GetRatio(that.tiles[i].facetItem.Img) < that.maxRatio)
                    that.maxRatio = that.tiles[i]._controller.GetRatio(that.tiles[i].facetItem.Img);
            }
        }

        var pt2Timeout = currentFilter.length == this.tiles.length ? 0 : 500;
        //Delay pt2 animation
        setTimeout(function () {
            that.rowscols = that.GetRowsAndColumns(that.columnWidth - 2, that.canvasHeightUIAdjusted - that.offsetY, that.maxRatio, that.bigCount);
            for (var i = 0; i < that.tiles.length; i++) {
                that.tiles[i].origwidth = that.rowscols.TileHeight / that.tiles[i]._controller.GetRatio(that.tiles[i].facetItem.Img);
                that.tiles[i].origheight = that.rowscols.TileHeight;
            }
            that.SetVisibleTileGraphPositions(that.rowscols, that.offsetX, that.offsetY, false, false);

        }, pt2Timeout);

        this.init = false;
    },
    GetUI: function () {
        if (Modernizr.canvas)
            return "<div class='pv-viewarea-graphview-overlay'></div>";
        else
            return "<div class='pv-viewpanel-unabletodisplay'><h2>Unfortunately this view is unavailable as your browser does not support this functionality.</h2>Please try again with one of the following supported browsers: IE 9+, Chrome 4+, Firefox 2+, Safari 3.1+, iOS Safari 3.2+, Opera 9+<br/><a href='http://caniuse.com/#feat=canvas'>http://caniuse.com/#feat=canvas</a></div>";
    },
    GetButtonImage: function () {
        return 'Content/images/GraphView.png';
    },
    GetButtonImageSelected: function () {
        return 'Content/images/GraphViewSelected.png';
    },
    GetViewName: function () {
        return 'Graph View';
    },
    /// Sets the tiles position based on the GetRowsAndColumns layout function
    SetVisibleTileGraphPositions: function (rowscols, offsetX, offsetY, initTiles, keepColsRows) {
        var columns = keepColsRows ? this.rowscols.Columns : rowscols.Columns;
        if (!keepColsRows)
            this.rowscols = rowscols;

        var startx = [];
        var starty = [];

        // First clear all tile locations greater that 1
        for (var l = 0; l < this.tiles.length; l++) {
            this.tiles[l].firstFilterItemDone = false;
          while (this.tiles[l]._locations.length > 1) 
              this.tiles[l]._locations.pop();   
        }
             
        for (var i = 0; i < this.buckets.length; i++) {
            var currentColumn = 0;
            var currentRow = 0;
            for (var j = 0, _jLen = this.tiles.length; j < _jLen; j++) {
                if ($.inArray(this.tiles[j].facetItem.Id, this.buckets[i].Ids) >= 0) {

if (!this.tiles[j].firstFilterItemDone) {
                    if (initTiles) {
                        //setup tile initial positions
                        this.tiles[j]._locations[0].startx = this.tiles[j]._locations[0].x;
                        this.tiles[j]._locations[0].starty = this.tiles[j]._locations[0].y;
                        this.tiles[j].startwidth = this.tiles[j].width;
                        this.tiles[j].startheight = this.tiles[j].height;
                    }

                    this.tiles[j].destinationwidth = rowscols.TileMaxWidth;
                    this.tiles[j].destinationheight = rowscols.TileHeight;
                    this.tiles[j]._locations[0].destinationx = (i * this.columnWidth) + (currentColumn * rowscols.TileMaxWidth) + offsetX;
                    this.tiles[j]._locations[0].destinationy = this.canvasHeightUIAdjusted - rowscols.TileHeight - (currentRow * rowscols.TileHeight) + offsetY;
                    this.tiles[j].start = PivotViewer.Utils.Now();
                    this.tiles[j].end = this.tiles[j].start + 1000;
this.tiles[j].firstFilterItemDone = true;
} else {
                    tileLocation = new PivotViewer.Views.TileLocation();
                    tileLocation.startx = this.tiles[j]._locations[0].startx;
                    tileLocation.starty = this.tiles[j]._locations[0].starty;
                    tileLocation.x = this.tiles[j]._locations[0].x;
                    tileLocation.y = this.tiles[j]._locations[0].y;
                    tileLocation.destinationx = (i * this.columnWidth) + (currentColumn * rowscols.TileMaxWidth) + offsetX;
                    tileLocation.destinationy = this.canvasHeightUIAdjusted - rowscols.TileHeight - (currentRow * rowscols.TileHeight) + offsetY;
                    this.tiles[j]._locations.push(tileLocation);
}

                    if (currentColumn == columns - 1) {
                        currentColumn = 0;
                        currentRow++;
                    }
                    else
                        currentColumn++;
                }
            }
        }
    },
    //Groups into buckets based on first n chars
    Bucketize: function (dzTiles, filterList, orderBy, stringFacets) {
        var bkts = [];
        for (var i = 0; i < dzTiles.length; i++) {
            if ($.inArray(dzTiles[i].facetItem.Id, filterList) >= 0) {
                var hasValue = false;
                for (var j = 0; j < dzTiles[i].facetItem.Facets.length; j++) {
                    if (dzTiles[i].facetItem.Facets[j].Name == orderBy && dzTiles[i].facetItem.Facets[j].FacetValues.length > 0) {

                        for (var m = 0; m < dzTiles[i].facetItem.Facets[j].FacetValues.length; m++) { 
                            var val = dzTiles[i].facetItem.Facets[j].FacetValues[m].Value;

                            var found = false;
                            for (var k = 0; k < bkts.length; k++) {
//this needs fixing to handle the whole range...
                                if (bkts[k].startRange == val) {
                                    // If item is not already in the bucket add it
                                    if ($.inArray(dzTiles[i].facetItem.Id, bkts[k].Ids) < 0)
                                        bkts[k].Ids.push(dzTiles[i].facetItem.Id);
                                    found = true;
                                }
                            }
                            if (!found)
                                bkts.push({ startRange: val, endRange: val, Ids: [dzTiles[i].facetItem.Id] });

                            hasValue = true;
                        }
                    }
                }
                //If not hasValue then add it as a (no info) item
                if (!hasValue) {
                    var val = "(no info)";
                    var found = false;
                    for (var k = 0; k < bkts.length; k++) {
                        if (bkts[k].startRange == val) {
                            bkts[k].Ids.push(dzTiles[i].facetItem.Id);
                            found = true;
                        }
                    }
                    if (!found)
                        bkts.push({ startRange: val, endRange: val, Ids: [dzTiles[i].facetItem.Id] });
                }
            }
        }

	// If orderBy is one of the string filters then only include buckets that are in the filter
	if ( stringFacets.length > 0 ) {
	    var sortIndex;
	    for ( var f = 0; f < stringFacets.length; f++ ) {
	        if ( stringFacets[f].facet == orderBy ) {
		    sortIndex = f;
		    break;
	        }
            }
	    if ( sortIndex != undefined  && sortIndex >= 0 ) {
	        var newBktsArray = [];
	        var filterValues = stringFacets[sortIndex].facetValue;
	        for ( var b = 0; b < bkts.length; b ++ ) {
		    var valueIndex = $.inArray(bkts[b].startRange, filterValues ); 
		    if (valueIndex >= 0 )
		        newBktsArray.push(bkts[b]);
	        }
	        bkts = newBktsArray;
	    }
	}

        var current = 0;
        while (bkts.length > 8) {
            if (current < bkts.length - 1) {
                bkts[current].endRange = bkts[current + 1].endRange;
                for (var i = 0; i < bkts[current + 1].Ids.length; i++) {
                    if ($.inArray(bkts[current+1].Ids[i], bkts[current].Ids) < 0) 
                        bkts[current].Ids.push(bkts[current + 1].Ids[i]);
                }
                bkts.splice(current + 1, 1);
                current++;
            } else
                current = 0;
        }

        return bkts;
    },
    // These need fixing
    GetSelectedCol: function (tile) {
        var that = this;
        selectedCol = Math.round((tile._locations[0].x - that.currentOffsetX) / tile.width);
        return selectedCol;
    },
    GetSelectedRow: function (tile) {
        var that = this;
        selectedRow = Math.round((that.canvasHeightUIAdjusted - (tile._locations[0].y - that.currentOffsetY)) / tile.height);
        return selectedRow;
    },
    /// Centres the selected tile
    CentreOnSelectedTile: function (selectedCol, selectedRow) {
        var that = this;
        var selectedTile;
        for (var i = 0; i < that.tiles.length; i++) {
            if (that.tiles[i].IsSelected()) {
                selectedTile = that.tiles[i];
                break;
            }
        }

        var rowscols = that.GetRowsAndColumns(that.columnWidth - 2, that.canvasHeightUIAdjusted, that.maxRatio, that.bigCount);

        var padding = 0;
        var gap = that.columnWidth - (rowscols.TileMaxWidth * rowscols.Columns);
        var bucket = Math.floor(selectedCol/ rowscols.Columns);
        if (gap > 0)
           padding = bucket * gap;

        that.currentOffsetX = ((rowscols.TileMaxWidth * selectedCol) * -1) + (that.width / 2) - (rowscols.TileMaxWidth / 2) + padding;

        //that.currentOffsetY = rowscols.TileHeight * (selectedRow - 1) - (that.canvasHeightUIAdjusted / 2) - (rowscols.TileHeight / 2);  
        that.currentOffsetY =   - rowscols.TileHeight * ((rowscols.Rows / 2) - (selectedRow + 1)) - ( that.canvasHeightUIAdjusted / 2 ) - (rowscols.TileHeight / 2);

        that.SetVisibleTileGraphPositions(rowscols, that.currentOffsetX, that.currentOffsetY, true, true);
    },
    handleSelection: function (selectedItem, selectedTile, clickX) {
        var that = this;
            var selectedCol = 0;
            var selectedRow = 0;
            var found = false;
            var dontFilter = false;
            var offsetX = 0, offsetY = 0;

            //First get the position of the selected tile
            if ( selectedItem != null && selectedTile !=null) {
                //determine row and column that tile is in in relation to the first tile
                //Actual position not really row/column so different from similarly 
                //named variables in gridview.js
                selectedX = selectedTile._locations[0].x;
                selectedY = selectedTile._locations[0].y;
            }

            //Reset slider to zero before zooming ( do this before sorting the tile selection
            //because zooming to zero unselects everything...)
            if (selectedItem != null && that.selected != selectedItem) {
                if (that.selected == ""){
                    var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
                    if (value != 0)
                       $('.pv-toolbarpanel-zoomslider').slider('option', 'value', 0);
                }
            }

            if ( selectedItem != null && selectedTile !=null) {
                selectedTile.Selected(true);
                found = true;

                //Used for scaling and centering 
                selectedCol = Math.round((selectedTile._locations[0].x - that.currentOffsetX) / selectedTile.width);
                selectedRow = Math.round((that.canvasHeightUIAdjusted - (selectedTile._locations[0].y - that.currentOffsetY)) / selectedTile.height);
                tileHeight = selectedTile.height;
                tileWidth = selectedTile.height / selectedTile._controller.GetRatio(selectedTile.facetItem.Img);
                tileOrigHeight = selectedTile.origheight;
                tileOrigWidth = selectedTile.origwidth;
                canvasHeight = selectedTile.context.canvas.height
                canvasWidth = selectedTile.context.canvas.width - ($('.pv-filterpanel').width() + $('.pv-infopanel').width());
            }

            // If an item is selected then zoom out but don't set the filter
            // based on clicking in a bar in the graph.
            if (that.selected != null && that.selected != "" && !found)
               dontFilter = true;

            //zoom in on selected tile
            if (selectedItem != null && that.selected != selectedItem) {
                // Find which is proportionally bigger, height or width
                if (tileHeight / canvasHeight > tileWidth/canvasWidth) 
                    origProportion = tileOrigHeight / canvasHeight;
                else
                    origProportion = tileOrigWidth / canvasWidth;
                //Get scaling factor so max tile dimension is about 60% total
                //Multiply by two as the zoomslider devides all scaling factors by 2
                scale = Math.round((0.75 / origProportion) * 2);

                // Zoom using the slider event
                if (that.selected == ""){
                    var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
                    value = scale; 
                    $('.pv-toolbarpanel-zoomslider').slider('option', 'value', value);
                }
                that.selected = selectedItem;
                that.CentreOnSelectedTile(selectedCol, selectedRow);

// Also need to scale the backgound colums...
// leave for now - tricky

              //  if (that.width < that.height) {
              //      var newWidth = that.width * that.rowscols.Columns * 0.6; //0.6 to leave 10% space
              //      var newHeight = (that.canvasHeightUIAdjusted / that.width) * newWidth;
              //  } else {
              //      var newHeight = that.canvasHeightUIAdjusted * that.rowscols.Rows * 0.6;
              //      var newWidth = (that.width / that.canvasHeightUIAdjusted) * newHeight;
              //  }

            //    var scaleY = newHeight / that.canvasHeightUIAdjusted;
            //    var scaleX = newWidth / (that.width - that.offsetX);
            //    that.columnWidth = newWidth / that.buckets.length;
//                that.columnWidth = that.currentWidth / that.buckets.length;

                //var rowscols = that.GetRowsAndColumns(that.columnWidth, newHeight, that.maxRatio, that.bigCount);
//                var rowscols = that.GetRowsAndColumns(that.columnWidth, that.currentHeight, that.maxRatio, that.bigCount);

                //that.currentOffsetX = -((selectedCol - that.offsetX) * scaleX) + (that.width / 2) - (rowscols.TileMaxWidth / 2);
 //               that.currentOffsetX = -((selectedCol) * (that.currentWidth/that.width)) - that.currentOffsetX + (that.width / 2) - (rowscols.TileMaxWidth / 2);

//                var rowNumber = Math.ceil((that.canvasHeightUIAdjusted - selectedRow) / that.rowscols.TileHeight);
//                that.currentOffsetY = 31 + (rowscols.TileHeight * (rowNumber - 1)l* that.currentWidth/that.width);

//                that.SetVisibleTileGraphPositions(rowscols, that.currentOffsetX, that.currentOffsetY, true, true);
                $('.pv-viewarea-graphview-overlay div').fadeOut('slow');
            } else {
                that.selected = selectedItem = "";
                //zoom out
                that.currentOffsetX = that.offsetX;
                that.currentOffsetY = that.offsetY;

                // Zoom using the slider event
                var value = $('.pv-toolbarpanel-zoomslider').slider('option', 'value');
                value = 0; 
                $('.pv-toolbarpanel-zoomslider').slider('option', 'value', value);

                $('.pv-viewarea-graphview-overlay div').fadeIn('slow');
            }
             $.publish("/PivotViewer/Views/Item/Selected", [selectedItem]);

        if (!found && !dontFilter) {
            var bucketNumber = Math.floor((clickX - that.offsetX) / that.columnWidth);
            $.publish("/PivotViewer/Views/Item/Filtered", [{ Facet: that.sortFacet, Item: that.buckets[bucketNumber].startRange, MaxRange: that.buckets[bucketNumber].endRange, ClearFacetFilters:true}]);
        }
    }
});
