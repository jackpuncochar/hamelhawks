const fs = require('fs');

// Read the roster JSON file
fs.readFile('roster2024.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    const roster = JSON.parse(data);

    // Loop through each player in the roster
    roster.forEach(player => {
        const fileName = `${player.pageUrl}.html`; // Use player's pageUrl as the file name
        // Determine image file path
        const imagePath = `./hamelphotos/${player.player.replace(/ /g, '').toLowerCase()}.png`;
        const defaultImagePath = './hamelphotos/default_player.png';
        // Check if image file exists, otherwise use default image
        const imageSrc = fs.existsSync(imagePath) ? imagePath : defaultImagePath;
        const playerHtml = `
<!DOCTYPE html>

<html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1">    

        <title>${player.player} - Player Page</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" integrity="sha512-ZN48mUBurB7MRlEJ6TnyG1ayu4YOpRLbp9gQ85alT/Xlm0DvIymUnvT65I2mpVoLSy0VvoRuRjbGsXZydBoZ5w==" crossorigin="anonymous" referrerpolicy="no-referrer" />
        <link href="./resources/css/main.css" type="text/css" rel="stylesheet">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik&display=swap">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Playball">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Oleo Script Swash Caps">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inconsolata">
    </head>

    <body class="bg-container">
        <a href="roster.html" class="back-button">
            <img src="chevron-left-solid.svg" class="chevron-left">
        </a>
        <!-- Header logo and navigation  -->
        <header class="header">
            <nav class="navbar">
                <ul class="nav-menu" id="nav-menu">
                    <li>
                        <div class="logo_area">
                        <a href="./index.html"><img src="hawks logo.png" alt="Hamel Hawks amateur baseball logo"></a>
                        </div>
                    </li>
                    <li><a href="./schedule.html" class="item">Schedule</a></li>
                    <li><a href="./roster.html" class="item">Roster</a></li>
                    <li><a href="./sponsors.html" class="item">Sponsors</a></li>
                    <li><a href="./paul-fortin-memorial-field.html" class="item">Field</a></li>
                    <li class="home-item"><a href="./index.html" class="item">Home</a></li>
                    <li class="contact-item"><a href="./contact.html" class="item">Contact</a></li>
                </ul>
                <div class="hamburger">
                    <span class="bar blue"></span>
                    <span class="bar blue"></span>
                    <span class="bar blue"></span>
                </div>    
            </nav>
        </header>
        
        <div class="player-header-container">
            <img src="${imageSrc}" alt="${player.player}" class="player-headshot">
            <div class="player-bio">
                <h2>${player.player} - ${player.number}</h2>
                <p><strong>Position:</strong> ${player.position}</p>
                <p><strong>Hometown:</strong> ${player.hometown}</p>
                <p><strong>College:</strong> ${player.college}</p>
                <p><strong>Season:</strong> ${player.season}</p>
            </div>
        </div>

        <div class='column bg-white no-margin'>
            <a href='https://icschillers.com/' target="_blank">
                <img src='ics_chillers.png' alt="ICS Chillers logo">
            </a>
            <a href='https://secure.fsboh.com/Pages/Default.html' target="_blank">
                <img src='farmers_bank_hamel.png' alt="Farmers State Bank of Hamel logo">
            </a>
            <a href='https://medinaentertainment.com/' target="_blank">
                <img src='medina_entertainment.png' alt="Medina Entertainment Center logo">
            </a>
            <a href='https://www.innkahootsbar.com/' target="_blank">
                <img src='inn_kahoots.png' alt="Inn Kahoots bar logo">
            </a>
            <a href='https://www.hamellions.org' target="_blank">
                <img src='hamel_lions.png' alt="Hamel Lions logo">
            </a>
            <a href='https://www.55rental.com/' target="_blank">
                <img src='hwy_55_rental.png' alt="Highway 55 Rental logo">
            </a>
        </div>

        <footer class="footer">
            <div class="footer__content">
                <div class="footer__section">
                    <h2>Links</h2>
                    <ul>
                        <li>
                            <a href="https://www.hamelbaseball.org/" target="_blank">Hamel Athletic Club</a>
                        </li>

                        <li>
                        <a href="https://www.instagram.com/hamelhawks/" target="_blank">Instagram</a>
                        </li>
                        
                        <li>
                        <a href="https://twitter.com/mnhamelhawks" target="_blank">Twitter</a>
                        </li>
                        
                        <li>
                        <a href="https://www.facebook.com/hamelhawks" target="_blank">Facebook</a>
                        </li>
                    </ul>
                </div>
                <div class="footer__section">
                    <a href="contact.html"> <!-- Link to your contact page -->
                        <h2>Contact</h2>
                    </a>
                    <ul>
                        <li>Fortin Field, Hamel, MN 55340</li>
                        <li>763-228-3136</li>
                        <li>gregd.hamelhawks@gmail.com</li>
                    </ul>
                </div>
            </div>
            <div class="footer__copyright">
                <p>&copy; 2024 Hamel Hawks Baseball.</p>
            </div>
        </footer>
        
        <script>
            const hamburger = document.querySelector(".hamburger");
            const navMenu = document.querySelector(".nav-menu");

            hamburger.addEventListener("click", mobileMenu);

            function mobileMenu() {
                hamburger.classList.toggle("active");
                navMenu.classList.toggle("responsive");
            }  
            // Get the current page URL
            const currentPageUrl = window.location.href;

            // Get all navigation links
            const navLinks = document.querySelectorAll('.nav-menu .item');

            // Loop through each navigation link
            navLinks.forEach(link => {
                // Check if the link's href matches the current page URL
                if (link.href === currentPageUrl) {
                    // Add the 'active' class to the parent <li> element
                    link.parentElement.classList.add('active');
                }
            });
        </script>
    </body>
</html>`;

        // Write the player HTML content to a new HTML file
        fs.writeFile(fileName, playerHtml, err => {
            if (err) {
                console.error(`Error writing file ${fileName}:`, err);
            } else {
                console.log(`Player page created for ${player.player}: ${fileName}`);
            }
        });
    });
});
