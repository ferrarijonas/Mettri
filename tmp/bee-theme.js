// navbar change on scroll
window.addEventListener('scroll', function(e) {
    const navbar = document.querySelector('#nav-transparent')
    const lastPosition = window.scrollY;
    changeNavBar(navbar, lastPosition);
})


function changeNavBar(navbar, lastPosition){
    if(navbar != null) {
        if (lastPosition > 80) {
            navbar.classList.add('bg-white');
            navbar.classList.add('shadow-sm');
            navbar.classList.remove('bg-transparent');
        } else if (navbar.classList.contains('active')) {
            navbar.classList.remove('bg-white');
            navbar.classList.remove('shadow-sm');
            navbar.classList.add('bg-transparent');
        } else {
            navbar.classList.remove('bg-white');
            navbar.classList.remove('shadow-sm');
            navbar.classList.add('bg-transparent');
        }
    }
}


// smooth scroll
$(document).ready(function(){
    const navbar = document.querySelector('#nav-transparent')
    const lastPosition = window.scrollY;
    changeNavBar(navbar, lastPosition);

  $('a[href^="#"]').on('click', function(e) {
    if (this.hash !== "") {
      e.preventDefault();

      var hash = this.hash;
      var navbar = $( '.navbar' ).outerHeight();

      $('html, body').animate({
        scrollTop: $(hash).offset().top - navbar
      }, 800);
    }
  });
});

// $(document).ready(function() {
//     function checkWidth() {
//         var windowSize = $(window).width();
//         $('#entregadores-tipo').css( "background-position-x", -(windowSize/2));
//     }
//     checkWidth();
//     $(window).resize(checkWidth);
// });

$(document).ready(function(){
    $('#testemunhosCarousel').on('slide.bs.carousel', function (e) {  
        var $e = $(e.relatedTarget);
        var idx = $e.index();
        var itemsPerSlide = 3;
        var totalItems = $('.carousel-item').length;
        
        if (idx >= totalItems-(itemsPerSlide-1)) {
            var it = itemsPerSlide - (totalItems - idx);
            for (var i=0; i<it; i++) {
                if (e.direction=="left") {
                    $('.carousel-item').eq(i).appendTo('.carousel-inner');
                }
                else {
                    $('.carousel-item').eq(0).appendTo('.carousel-inner');
                }
            }
        }
    });
    $('.counterup').counterUp({
        delay: 10,
        time: 1000
    });

    AOS.init();
});

