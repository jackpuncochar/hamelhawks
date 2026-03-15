// Global stats storage for reuse across pages (player cards, leaderboards, etc.)
window.playerStats = {};
const statsCache = {};

const minimumRequirements = {
    batting: { PA: 1 },
    pitching: { IP: 0.1 },
    fielding: { TC: 1 }
};

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("year-select").addEventListener("change", loadStatsForYear);

    // default tab
    document.getElementById("batting").style.display = "block";
    document.querySelector(".tab-button").classList.add("active");

    loadStatsForYear();
});

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

function loadStatsForYear() {

    const year = document.getElementById("year-select").value;
    const csvFile = `cleaned_stats_${year}.csv`;

    if (statsCache[year]) {
        renderTables(statsCache[year]);
        return;
    }

    Papa.parse(csvFile, {
        download: true,
        header: true,
        dynamicTyping: false,

        complete: function(results) {

            let data = results.data || [];

            data = data.filter(row =>
                Object.values(row).some(v => v && v.trim() !== "")
            );

            statsCache[year] = data;
            window.playerStats[year] = data;

            renderTables(data);
        },

        error: function() {
            console.error("Failed to load", csvFile);
        }
    });
}

function renderTables(data) {

    clearTables();

    const battingData = filterData("batting", data);
    const pitchingData = filterData("pitching", data);
    const fieldingData = filterData("fielding", data);

    populateTable("batting", battingData);
    populateTable("pitching", pitchingData);
    populateTable("fielding", fieldingData);
}

function clearTables() {

    ["batting","pitching","fielding"].forEach(table => {

        if ($.fn.DataTable.isDataTable(`#${table}-table`)) {
            $(`#${table}-table`).DataTable().destroy();
        }

        $(`#${table}-table tbody`).empty();
    });
}

function filterData(type, data) {

    const requirements = minimumRequirements[type];

    return data.filter(row => {

        for (const key in requirements) {

            if (!row[key] || parseFloat(row[key]) < requirements[key]) {
                return false;
            }
        }

        return true;
    });
}

function populateTable(tableType, data) {

    const columns = getColumnNames(tableType);

    const totalRow = data.find(r => r.Name === "Total");
    data = data.filter(r => r.Name !== "Total");

    const table = $(`#${tableType}-table`).DataTable({
        data: data,
        columns: columns,
        order: [[3, "desc"]],
        searching: false,
        paging: false,
        info: false
    });

    if (totalRow) {

        const rowNode = table.row.add(totalRow).draw().node();
        rowNode.classList.add("total-row");

        const tbody = $(`#${tableType}-table tbody`);
        tbody.append($(rowNode));
    }

    table.on("draw", function() {

        const tbody = $(`#${tableType}-table tbody`);
        const totalRowNode = tbody.find(".total-row");
        tbody.append(totalRowNode);
    });
}

function getColumnNames(tableType) {

    const columns = {};

    $(`#${tableType}-table thead th`).each(function(index){

        const thText = $(this).text().trim();
        let csvName = mapToCSVColumnName(thText, tableType);

        if(columns[csvName]){
            csvName += "_" + index;
        }

        columns[csvName] = {
            title: thText,
            data: csvName
        };

    });

    return Object.values(columns);
}

function mapToCSVColumnName(thText, tableType){

    if(thText === "#") return "Number";
    if(thText === "") return "Name";

    if(thText === "BA") return "batting_avg";
    if(thText === "Fielding %") return "fielding_avg";

    if(thText === "SO"){
        return tableType === "batting" ? "batting_SO" : "pitching_SO";
    }

    if(thText === "BB"){
        return tableType === "batting" ? "batting_BB" : "pitching_BB";
    }

    if(thText === "GP"){
        return tableType === "batting" ? "batting_GP" : "pitching_GP";
    }

    if(thText === "H"){
        return tableType === "batting" ? "batting_H" : "pitching_H";
    }

    return thText;
}