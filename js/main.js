$(document).ready(function()
{
	$("#menu").click(function()
	{
		var topPadding = parseInt($("#header").css("padding-bottom"));
		if(topPadding > 0) //close
		{
			$("#header").css("padding-bottom", "0");
		}
		else
		{
			$("#header").css("padding-bottom", "30");
		}
	});
});

$(window).on('resize', function()
{
	if($(window).width() > 600)
	{
		$("#header").css("padding-bottom", "0");
	}
});

/* General Functions */

// Shows an overlay with text, including a title and description, to explain something.
function showInfo(title, description)
{
	$("body").append('<div id="overlay-info" class="overlay-transparent">' +
		'<div class="centered info-cont">' +
			'<div class="title">' + title + '</div>' +
			'<div class="description">' + description + '</div>' +
		'</div>' +
		'<img id="close" src="images/icons/cross.svg">' +
	'</div>');
	$("#overlay-info .centered").click(function(event)
	{
		event.stopPropagation();
	});
	$("#overlay-info").click(closeInfo);
	$("#overlay-info").fadeIn();
	setPageBlur(true);
}

// Fades out and removes the info overlay specifically
function closeInfo()
{
	setPageBlur(false);
	$("#overlay-info").fadeOut(function()
	{
		$(this).remove();
	});
}

// instantiates a gallery given a gallery data object, which contains info about all images to display
// this can be either an array of hashes if you want more information in each gallery item
// or an array of strings if you just need to display images
// Possible options
//	showInfo {Boolean} - whether to show a small info icon on the bottom left. DEFAULT - false
// TODO: Make gallery show a counter or a preview thing at the bottom
function Gallery(galleryData, options)
{
	this.galleryData = galleryData; //the gallery data
	this.currentImageIndex; //the index of the image being displayed in the gallery data
	this.options = options;
	self = this; // we need a scoped version of the gallery object for reference in functions

	// Create the HTML if it isnt' there already
	if($("#overlay-main").length == 0)
	{
		var navigationDots = ""; // HTML for the navigation circles that show you how many images there are
		navigationDots = '<div class="nav-dot"></div>'.repeat(galleryData.length); //repeat a single dot as many times as there are image

		$("body").append(
			'<div id="overlay-main" class="overlay overlay-transparent">' +
			'</div>' +
			'<div id="overlay-controls" class="overlay">' +
				'<img id="close" src="images/icons/cross.svg">' +
				'<img id="right" class="vertically-centered arrow" src="images/icons/chevron-thin-right.svg">' +
				'<img id="left" class="vertically-centered arrow" src="images/icons/chevron-thin-left.svg">' +
				'<div class="gallery-nav">' + navigationDots + '</div>' +
			'</div>'
		);

		$(".nav-dot").click(function()
		{
			self.showImage($(this).index()); //show the image with the same index as this dot
		});
	}

	// Show the image with the given index in the galleryData
	this.showImage = function(index)
	{
		self.currentImageIndex = index;
		$("#overlay-controls .nav-dot").removeClass("active");
		$($("#overlay-controls .nav-dot")[index]).addClass("active");
		setOverlayImage(getImageUrl(this.galleryData[index])); //set the image
		setPageBlur(true);
		$(".overlay").fadeIn(); //then fade in
	}

	// Go to the next image
	this.nextImage = function()
	{
		if($("#overlay-info:visible").length > 0) //if info is showing up
			return; //don't do anything

		if(self.currentImageIndex < self.galleryData.length - 1) // if we aren't on the last item in the gallery
	  		self.currentImageIndex++; //go to next
	  	else //otherwise, loop back to the first
	  		self.currentImageIndex = 0;

	  	self.showImage(self.currentImageIndex);
	}
	this.previousImage = function()
	{
		if($("#overlay-info:visible").length > 0) //if info is showing up
			return;

		if(self.currentImageIndex > 0)
	  		self.currentImageIndex--;
	  	else
	  		self.currentImageIndex = self.galleryData.length - 1;

	  	self.showImage(self.currentImageIndex);
	}

	// closes the gallery with a nice animation
	this.close = function(callback)
	{
		setPageBlur(false);
		$(".overlay").fadeOut(callback);
	}

	// closes the gallery and deletes all DOM associated
	this.destroy = function()
	{
		self.close(function()
		{
			$("#overlay-main, #overlay-controls").remove();
		});
	}

	// Now that all methods are defined, let's map them to the DOM
	$("#overlay-main, #overlay-controls #close").click(self.close);
	$("#overlay-controls #right").click(self.nextImage);
	$("#overlay-controls #left").click(self.previousImage);

	/*****************************/
	/****** PRIVATE METHODS ******/
	/*****************************/

	function setOverlayImage(url)
	{
		if($("#overlay-main:visible").length > 0 && $("#overlay-main img").length > 0) //if there's already an image
		{
			$("#overlay-main .img-container").fadeOut(300, function() //fade it out
			{
				//then transition to new image by setting it, hiding it instantly, then fadin in
				setOverlayHTMLWithImage(url);
			  	$("#overlay-main .img-container").hide().fadeIn(300);
			});
		}
		else
		{
			setOverlayHTMLWithImage(url);
		}

		function setOverlayHTMLWithImage(url)
		{
			var infoIcon = "";

			if(options && options.showInfo)
				infoIcon = '<div class="icon info"></div>';

		  	$("#overlay-main").html(
		  	'<div class="img-base centered">' +
		  		'<div class="img-container">' +
			  		'<img src="' + url + '">' +
			  		infoIcon +
		  		'</div>' +
		  	'</div>');

		  	$("#overlay-main .img-container").click(function(event)
		  	{
		  		event.stopPropagation();
		  	});

		  	$("#overlay-main .img-container .icon.info").click(function()
		  	{
		  		showInfo(self.galleryData[self.currentImageIndex].title, self.galleryData[self.currentImageIndex].description)
		  	});
		}
	}

	/*
	 * Returns the image url from a given gallery item. This is needed as gallery items
	 * may be Javascript objects with a URL field, or just straight string URLs.
	 * @param {Object/string} galleryItem - The gallery item we want to get the URL of
	 * @return {string}	- The URL of the gallery item passed in
	 */
	function getImageUrl(galleryItem)
	{
		if (typeof galleryItem == "object")
			return galleryItem.url;
		else if (typeof galleryItem == "string")
			return galleryItem;
		else
		{
			console.error("Invalid gallery item type: " + typeof galleryItem);
			return null;
		}
	}
}

function setPageBlur(isBlurred)
{
	if(isBlurred)
		$("#header, .page-container, .footer").addClass("blur");
	else
		$("#header, .page-container, .footer").removeClass("blur");
}