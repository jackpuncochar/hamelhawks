const availableStandingsYears = [2026, 2025];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("league").style.display = "block";
    document.querySelector(".tab-button").classList.add("active");
    document.querySelector(".class-pill").classList.add("active");

    populateYearSelector();
    loadStandings();
});

function populateYearSelector() {
    const select = document.getElementById("year-select");
    if (!select) return;

    availableStandingsYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });

    select.value = availableStandingsYears[0];
}

function getSelectedYear() {
    const select = document.getElementById("year-select");
    return select ? Number(select.value) : availableStandingsYears[0];
}

function onYearChange() {
    loadStandings(getSelectedYear());
}

function openTab(evt, tabName) {
    const tabContent = document.getElementsByClassName("tab-content");
    const tabButtons = document.getElementsByClassName("tab-button");

    for (let i = 0; i < tabContent.length; i++) {
        tabContent[i].style.display = "none";
    }

    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}

function setClassFilter(evt, leagueClass) {
    const pills = document.getElementsByClassName("class-pill");

    for (let i = 0; i < pills.length; i++) {
        pills[i].classList.remove("active");
    }

    evt.currentTarget.classList.add("active");

    const table = $("#class-table").DataTable();
    table.column(1).search(`^${leagueClass}$`, true, false).draw();
}

async function loadStandings(year = null) {
    year = year || getSelectedYear();

    try {
        // Future backend endpoint.
        let response = await fetch(`/api/standings?league=north-star&year=${year}`);

        if (!response.ok) {
            response = await fetch(`standings_data_${year}.json`);
        }

        const standings = await response.json();
        const leagueData = standings.league || [];

        addLeagueMetrics(leagueData);
        const classData = getClassesFromLeague(leagueData);
        addClassMetrics(classData);

        renderLeagueTable(leagueData);
        renderClassTable(classData);

        const updatedAt = standings.updatedAt || "Unavailable";
        document.getElementById("standings-updated").textContent = `Last updated: ${updatedAt}`;
    } catch (error) {
        console.error("Failed to load standings", error);
        document.getElementById("standings-updated").textContent = "Last updated: unavailable";
    }
}

function getClassesFromLeague(leagueData) {
    return leagueData.reduce((classes, team) => {
        const cls = team.class;
        if (!classes[cls]) {
            classes[cls] = [];
        }
        classes[cls].push({
            team: team.team,
            wins: team.classWins != null ? team.classWins : team.leagueWins != null ? team.leagueWins : team.wins,
            losses: team.classLosses != null ? team.classLosses : team.leagueLosses != null ? team.leagueLosses : team.losses
        });
        return classes;
    }, {});
}

function addLeagueMetrics(leagueData) {
    leagueData.forEach(team => {
        const wins = team.leagueWins != null ? team.leagueWins : team.wins;
        const losses = team.leagueLosses != null ? team.leagueLosses : team.losses;
        team.leagueWins = wins;
        team.leagueLosses = losses;
        team.leaguePct = formatPct(wins, losses);
    });

    const leader = [...leagueData].sort((a, b) => {
        const aPct = getWinPctValue(a.leagueWins, a.leagueLosses);
        const bPct = getWinPctValue(b.leagueWins, b.leagueLosses);
        return bPct - aPct || b.leagueWins - a.leagueWins || a.leagueLosses - b.leagueLosses;
    })[0];
    leagueData.forEach(team => {
        team.leagueGb = leader && team !== leader ? formatGb(leader, team, "league") : "-";
    });
}

function addClassMetrics(classes) {
    Object.values(classes).forEach(rows => {
        rows.forEach(row => {
            row.winPct = formatPct(row.wins, row.losses);
        });

        const leader = [...rows].sort((a, b) => {
            const aPct = getWinPctValue(a.wins, a.losses);
            const bPct = getWinPctValue(b.wins, b.losses);
            return bPct - aPct || b.wins - a.wins || a.losses - b.losses;
        })[0];
        rows.forEach(row => {
            row.gb = leader && row !== leader ? formatGb(leader, row) : "-";
        });
    });
}

function formatPct(wins, losses) {
    const total = wins + losses;
    if (total === 0) {
        return "-";
    }
    return (wins / total).toFixed(3).replace(/^0/, "");
}

function getWinPctValue(wins, losses) {
    const total = wins + losses;
    return total === 0 ? 0 : wins / total;
}

function formatGb(leader, team, prefix) {
    const leaderWins = leader[prefix + "Wins"] != null ? leader[prefix + "Wins"] : leader.wins;
    const leaderLosses = leader[prefix + "Losses"] != null ? leader[prefix + "Losses"] : leader.losses;
    const teamWins = team[prefix + "Wins"] != null ? team[prefix + "Wins"] : team.wins;
    const teamLosses = team[prefix + "Losses"] != null ? team[prefix + "Losses"] : team.losses;
    const gb = ((leaderWins - teamWins) + (teamLosses - leaderLosses)) / 2;
    return gb === 0 ? "-" : gb.toFixed(1);
}

function renderLeagueTable(data) {
    if ($.fn.DataTable.isDataTable("#league-table")) {
        $("#league-table").DataTable().destroy();
    }

    $("#league-table tbody").empty();

    $("#league-table").DataTable({
        data,
        columns: [
            { data: "team", title: "Team", className: "text-left", render: function(data, type, row) {
                var logoSrc = 'resources/images/' + data.toLowerCase().replace(/\s+/g, '') + '.png';
                return '<img src="' + logoSrc + '" alt="' + data + '" style="width:20px; height:20px; margin-right:10px; vertical-align:middle;">' + data;
            } },
            { data: "class", title: "Class" },
            { data: "leagueWins", title: "W", defaultContent: "", render: function(data, type, row) { return data != null ? data : row.wins; } },
            { data: "leagueLosses", title: "L", defaultContent: "", render: function(data, type, row) { return data != null ? data : row.losses; } },
            { data: "leaguePct", title: "PCT", defaultContent: "", render: function(data, type, row) { return data != null ? data : row.winPct; } },
            { data: "leagueGb", title: "GB", defaultContent: "", render: function(data, type, row) { return data != null ? data : row.gb; } }
        ],
        order: [[4, "desc"], [2, "desc"]],
        searching: false,
        paging: false,
        info: false,
        autoWidth: false
    });
}

function renderClassTable(classes) {
    const rows = [
        ...(classes.B || []).map(team => ({ ...team, class: "B" })),
        ...(classes.C || []).map(team => ({ ...team, class: "C" }))
    ];

    if ($.fn.DataTable.isDataTable("#class-table")) {
        $("#class-table").DataTable().destroy();
    }

    $("#class-table tbody").empty();

    $("#class-table").DataTable({
        data: rows,
        columns: [
            { data: "team", title: "Team", className: "text-left", render: function(data, type, row) {
                var logoSrc = 'resources/images/' + data.toLowerCase().replace(/\s+/g, '') + '.png';
                return '<img src="' + logoSrc + '" alt="' + data + '" style="width:20px; height:20px; margin-right:10px; vertical-align:middle;">' + data;
            } },
            { data: "class", title: "Class" },
            { data: "wins", title: "W" },
            { data: "losses", title: "L" },
            { data: "winPct", title: "PCT" },
            { data: "gb", title: "GB" }
        ],
        order: [[4, "desc"], [2, "desc"]],
        searching: true,
        paging: false,
        info: false,
        dom: "t",
        autoWidth: false
    });

    const table = $("#class-table").DataTable();
    table.column(1).search("^B$", true, false).draw();
}
