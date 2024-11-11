        /* ----- TYPING EFFECT ----- */
        var typed = new Typed(".auto-type", {
            strings:["Data Analyst.", "Business Analyst.", "Business Intelligence Analyst.", "Data Scientist."],
            typeSpeed:50,
            backSpeed:50,
            loop:true
        });

// Select all elements with the class 'project-box'
document.querySelectorAll('.project-box').forEach(box => {
    // Add an event listener for the 'click' event on each 'project-box'
    box.addEventListener('click', () => {
        // Toggle the 'active' class on the clicked element
        box.classList.toggle('active');
    });
});

