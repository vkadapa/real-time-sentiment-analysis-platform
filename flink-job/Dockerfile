FROM flink:1.18-java17

# Set working directory
WORKDIR /opt/flink

# Copy Maven wrapper and pom.xml
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .

# Download dependencies
RUN chmod +x mvnw && ./mvnw dependency:go-offline

# Copy source code
COPY src src

# Build the application
RUN ./mvnw clean package -DskipTests

# Copy the JAR to Flink lib directory
RUN cp target/sentiment-flink-job-1.0.0.jar /opt/flink/usrlib/sentiment-flink-job.jar

# The base image already has the entrypoint configured
