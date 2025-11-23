# Build stage
FROM maven:3.9-eclipse-temurin-17 AS builder

# Set working directory
WORKDIR /build

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source code
COPY src src

# Build the application
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM flink:1.18-java17

# Copy the JAR from build stage to Flink lib directory
COPY --from=builder /build/target/sentiment-flink-job-1.0.0.jar /opt/flink/usrlib/sentiment-flink-job.jar

# The base image already has the entrypoint configured
