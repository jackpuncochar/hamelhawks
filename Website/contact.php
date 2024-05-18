<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Retrieve form data
    $first_name = $_POST['first_name'];
    $last_name = $_POST['last_name'];
    $email = $_POST['email'];
    $phone = $_POST['phone'];
    $category = $_POST['category'];
    $message = $_POST['message'];

    // Set up email parameters
    $to = "puncochar.jackr@gmail.com"; // Replace with your email address
    $subject = "Hamel Hawks Contact Form Submission";
    $body = "First Name: $first_name\n" .
            "Last Name: $last_name\n" .
            "Email: $email\n" .
            "Phone: $phone\n" .
            "Category: $category\n\n" .
            "Message:\n$message";

    // Send email
    if (mail($to, $subject, $body)) {
        // Email sent successfully
        echo "<p>Thank you for your message. We will get back to you soon!</p>";
    } else {
        // Error sending email
        echo "<p>Sorry, there was an error sending your message. Please try again later.</p>";
    }
} else {
    // Form not submitted via POST method
    echo "<p>Oops! Something went wrong.</p>";
}
?>

